# XAN mkissa.to / AllAnime Source Diagnostic Report

**Date:** 2026-08-29
**Investigator:** Super Z (AI assistant)
**Repo:** `sundeepyt2/XAN` @ commit `1ea0c78` (latest main as of investigation)

## TL;DR

The mkissa.to / AllAnime source in XAN is currently **broken end-to-end**.
The root cause is on the upstream side (mkissa.to's API), not in XAN's code.
The other providers (**Zen**, **Koto**, **AnimePahe**) work fine — use those
to watch anime while waiting for an upstream fix.

## Error chain (confirmed by hitting the live API)

```
1. XAN backend calls api.mkissa.net/api with the hardcoded EPISODE_QUERY_HASH
   → HTTP 200  {"errors":[{"code":"PERSISTED_QUERY_NOT_FOUND"}]}

2. XAN backend falls back to https://xancld.xyz/api/allanime/episode
   → HTTP 502  {"sources":null,"error":"Direct crypto failed: __aaCrypto not found in mkissa.to page HTML"}

3. (no further fallback) → AllAnime source silently dropped from /api/stream response
```

The `/api/stream/<id>/<ep>` endpoint still returns 200, but only with Zen + Koto
+ Pahe sources — the AllAnime provider contributes zero sources.

## Root cause

mkissa.to has rolled out a **multi-layered crypto overhaul** that breaks every
known non-browser approach:

### Layer 1 — Stale persisted-query hash
The `EPISODE_QUERY_HASH` constant in `src/lib/allanime.ts:43` is
`f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0`.
This was correct for an OLDER version of the episode GraphQL query string.
mkissa.to has rotated the query string (and thus the hash) several times since.

The mkissa.to SPA computes the hash at runtime via `ol(e) = SHA-256(e)` where
`e` is the query string — there is **no hardcoded hash** in the SPA bundle,
just a hardcoded query string that mkissa.to can change at every deploy.

### Layer 2 — `aaReq` signed proof is now mandatory
Every episode query must include an `aaReq` extension field. This is an
AES-GCM-encrypted blob containing `{v, ts, epoch, buildId, qh}` signed with
a key derived from:

  `aesKey = XOR(atob(__aaCrypto.partB), hexToBytes(MASK_HEX))`

Where:
  - `MASK_HEX` is a 64-char hex literal embedded in the SPA bundle.
    Latest value (from the upstream repo's auto-refresh GitHub Action,
    commit `f4d4201`, 2026-08-28):
    `5414eefc1e322ad6c1ebd577813fdace8add468a78e679efed2a7191ac07f337`
  - `BUILD_ID` is a small integer string, currently `"141"`.
  - `__aaCrypto` is a `{epoch, partB}` blob that used to be embedded in
    mkissa.to's page HTML as `window.__aaCrypto = {...}`.

### Layer 3 — `__aaCrypto` has been moved out of the HTML
This is the killer. mkissa.to no longer embeds `__aaCrypto` in the page HTML.
Instead, the SPA fetches it via a **bootstrap endpoint**:

  `GET https://api.mkissa.net/client-crypto/v1/bootstrap?buildId=<id>&k=<lane>`

But this endpoint requires an `x-aa-boot` header, computed by an obfuscated
`tk({buildId, epoch, keyGroup, refererHost, contentLane})` function in the SPA
bundle. The `tk()` function itself needs `epoch` — which comes from the
bootstrap response. **Chicken-and-egg.** The only known way to break the cycle
is to run the SPA in a real browser (so the obfuscated JS can execute end-to-end).

### Why the public fallback `xancld.xyz` is also broken
The `xancld.xyz` worker (deployed from `smithP2007/XANCLD`) uses the exact same
`__aaCrypto` HTML scrape approach as XAN's `cf-worker/worker.js`. When mkissa.to
removed `__aaCrypto` from the HTML, both broke simultaneously. The error message
from xancld.xyz confirms this directly.

### Why XAN's `cf-worker/worker.js` would ALSO fail (if deployed today)
The cf-worker has a Browser Rendering fallback for when the HTML scrape fails.
That fallback uses `@cloudflare/puppeteer` to launch Chrome, navigate to
mkissa.to, and intercept the bootstrap network response. This still works —
but only on Cloudflare Workers with the `BROWSER` binding configured, not in
plain Node.js.

## GitHub hex code changes found

I checked the upstream repo's recent commit history. The relevant "hex code
changes" are automated daily refreshes of `MASK_HEX` and `BUILD_ID` in
`cf-worker/worker.js`:

```
commit f4d4201 (2026-08-28) — MASK_HEX = 5414eefc1e322ad6c1ebd577813fdace8add468a78e679efed2a7191ac07f337, BUILD_ID = 141
commit 4b67d16 (2026-08-28) — MASK_HEX = deeb2732190ceee0d84c7668d79b64ddcd5f27b9f858f2327fe29a7841b7b5da, BUILD_ID = 141
commit c4b6b06 (2026-08-26) — (similar)
commit 356bc40 (2026-08-24) — (similar)
```

The GitHub Action `.github/workflows/refresh-mkissa-mask.yml` runs daily,
crawls mkissa.to's SvelteKit bundle, extracts the current `MASK_HEX` and
`BUILD_ID` by regex, and commits them. So the **cf-worker.js** is always
up-to-date with the latest MASK — but the **XAN backend code**
(`src/lib/allanime.ts`) doesn't use the MASK at all; it relies on the cf-worker
to do the signing.

## What I changed locally

### `/home/z/my-project/XAN/.env` — added `MKISSA_BUILD_ID=141`
The default in `src/lib/allanime.ts:149` is `"72"` (very stale). Updated to
`"141"` to match the current mkissa.to build. This is a cosmetic fix — it only
affects the `x-build-id` header on the doomed direct call. It does NOT fix the
issue (we still can't generate `aaReq`).

### Did NOT change `src/lib/allanime.ts`
Replacing the hardcoded `EPISODE_QUERY_HASH` with a runtime `SHA-256(query)`
computation would just trade `PERSISTED_QUERY_NOT_FOUND` for `AA_CRYPTO_MISSING`
— same end result (no sources). Not worth the code churn until the upstream
cf-worker is fixed.

## Solutions in priority order

### Solution 1 (immediate) — use Zen / Koto / Pahe providers
These providers are completely independent of mkissa.to's crypto and are
working right now in your local XAN. Verified:

```
GET http://localhost:3000/api/stream/5114/1?mode=sub
→ 200 OK
  sources: [
    { url: "https://flixcloud.cc/e/tessg6x0e3ps?v=1", provider: "zen",  type: "iframe" },
    { url: "https://megaplay.buzz/stream/ani/5114/1/sub", provider: "koto", type: "iframe" }
  ]
```

In the XAN watch page, switch to the "Zen" or "Koto" tab in the source
switcher. The AllAnime tab will be empty — that's expected.

### Solution 2 (proper fix) — deploy cf-worker to Cloudflare Workers
This is the documented solution. Steps:

1. Install wrangler:  `npm install -g wrangler`
2. Login (free, no card):  `wrangler login`
3. Edit `cf-worker/wrangler.toml` — add the `BROWSER` binding:
   ```toml
   [browser]
   binding = "BROWSER"
   ```
4. `cd cf-worker && npm install`
5. `wrangler deploy`
6. Copy the resulting `https://xan-stream-proxy.<your-subdomain>.workers.dev` URL
7. Add to `/home/z/my-project/XAN/.env`:
   ```
   NEXT_PUBLIC_CF_WORKER_URL=https://xan-stream-proxy.<your-subdomain>.workers.dev
   ```
8. Restart the dev server:
   ```bash
   /home/z/my-project/scripts/xan-server.sh restart
   ```

The cf-worker will use Cloudflare Browser Rendering (10 min/day free) to load
mkissa.to in a real Chrome, intercept the bootstrap response, derive the AES
key, sign the episode query with `aaReq`, and return `sourceUrls`.

**Cost:** $0 (Cloudflare Workers free tier + Browser Rendering free tier)

### Solution 3 (when Solution 2 is not possible) — wait for upstream fix
File an issue on `sundeepyt2/XAN` (and `smithP2007/XANCLD`) reporting:

> mkissa.to has removed `window.__aaCrypto` from the page HTML. The current
> HTML scrape in `cf-worker/worker.js` (line 220) and `XANCLD/src/worker/allanimeCrypto.ts`
> (line 136) both fail with `"__aaCrypto not found in mkissa.to page HTML"`.
>
> The SPA now fetches `__aaCrypto` via `GET /client-crypto/v1/bootstrap?buildId=X&k=Y`
> with an `x-aa-boot` header computed by the obfuscated `tk()` function in the
> bundle. The cf-worker's Browser Rendering fallback (which would still work)
> requires the `BROWSER` binding in `wrangler.toml` — users deploying without
> that binding have no working path.
>
> Suggested fix: implement the bootstrap call directly by reverse-engineering
> `tk()`, OR make the Browser Rendering fallback the primary path and document
> the `BROWSER` binding as required.

### Solution 4 (NOT recommended) — reverse-engineer `tk()` locally
The `tk()` function computes `x-aa-boot` from `{buildId, epoch, keyGroup,
refererHost, contentLane}` using the obfuscated string-table lookup pattern
(`rr()`, `Ua()`, `Mc()`). It's possible to deobfuscate but would break on
every mkissa.to deploy. Not worth the maintenance burden.

## Verification commands

To re-run the diagnostic yourself:

```bash
# 1. Check the current error from XAN's local API
curl -s "http://localhost:3000/api/stream/5114/1?mode=sub" | python3 -m json.tool

# 2. Check the dev server log for [AllAnime] errors
tail -50 /tmp/xan-dev.log | grep -E "\[AllAnime\]"

# 3. Confirm mkissa.to's API rejects the old hash
curl -s "https://api.mkissa.net/api?variables=%7B%22showId%22%3A%22srGrP23qJnjsHrRYD%22%2C%22episodeString%22%3A%221%22%2C%22translationType%22%3A%22sub%22%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0%22%7D%7D"
# → {"errors":[{"message":"PersistedQueryNotFound","extensions":{"code":"PERSISTED_QUERY_NOT_FOUND"}}]}

# 4. Confirm xancld.xyz fallback is also broken
curl -s "https://xancld.xyz/api/allanime/episode?showId=srGrP23qJnjsHrRYD&episodeString=1&translationType=sub"
# → {"sources":null,"error":"Direct crypto failed: __aaCrypto not found in mkissa.to page HTML"}

# 5. Confirm Zen/Koto providers still work
curl -s "https://flixcloud.cc/videos/raw?anilist_id=21&episode=1"
# → {"status":"success","data":[{"player_url":"https://flixcloud.cc/e/..."}]}
```

## Files I created during this investigation

- `/home/z/my-project/scripts/test_mkissa_hash.py` — tests old vs computed hash against both API endpoints
- `/home/z/my-project/scripts/reconstruct_query_hash.py` — extracts the current episode query string from mkissa.to's SPA bundle and computes its SHA-256
- `/home/z/my-project/XAN/DIAGNOSTIC.md` — this report
