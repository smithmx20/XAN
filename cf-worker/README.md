# XAN Cloudflare Worker v6 — Stream Proxy + AllAnime Episode Resolver

Single Cloudflare Worker that does both:
1. **Stream proxy** — proxies video segments with Referer/Origin headers (saves Vercel bandwidth)
2. **AllAnime episode resolver** — resolves episode sources via direct crypto + Browser Rendering fallback

## What changed in v6 (2026-08-29)

mkissa.to (formerly allmanga.to) overhauled its crypto:
- `__aaCrypto` is no longer in page HTML — it's behind a bootstrap API endpoint
- Episode queries require a signed `aaReq` extension (AES-GCM encrypted)
- The `aaReq` payload must include `k: contentLane` (was missing in v5 — BUG FIX #1)
- The `aaReq` IV must include `:lane` suffix (was missing in v5 — BUG FIX #2)
- Episode queries require a Cloudflare Turnstile token (`NEED_CAPTCHA`)

**v6 fixes all of this:**
- **Path A (fast, no browser):** Computes `x-aa-boot` + `aaReq` locally by loading mkissa.to's SPA chunk in the Worker. Calls the bootstrap + episode GraphQL directly. Works if the Worker's IP isn't challenged by Turnstile.
- **Path B (reliable, uses browser):** Falls back to Browser Rendering — loads mkissa.to in managed Chrome, lets the SPA handle all crypto + Turnstile, intercepts the episode response.

## How it works

```
XAN calls Worker /allanime/episode?showId=...&episodeString=1&translationType=sub
    │
    ├─ Path A: Direct crypto (fast, ~2s)
    │   1. Load mkissa.to's SPA chunk in the Worker (cached after first load)
    │   2. Compute x-aa-boot using the SPA's own tk() function
    │   3. Call bootstrap endpoint → get {epoch, partB}
    │   4. Derive AES key = XOR(atob(partB), hexToBytes(MASK))
    │   5. Compute aaReq using the SPA's xk() function (with FIXED bugs)
    │   6. POST episode GraphQL → get tobeparsed
    │   7. Decrypt tobeparsed → sourceUrls
    │   └─ If NEED_CAPTCHA → fall back to Path B
    │
    └─ Path B: Browser Rendering (~10-15s, used as fallback)
        1. Launch managed Chrome (Cloudflare Browser Rendering)
        2. Navigate to mkissa.to/watch/<showId>/p-<ep>-<type>
        3. SPA auto-handles: bootstrap + crypto + Turnstile + episode query
        4. Intercept bootstrap response → derive AES key
        5. Intercept episode response → decrypt tobeparsed
        6. Return sourceUrls
```

## Why use this Worker

| Feature | This Worker (v6) | Local free-solver | No solver |
|---------|------------------|-------------------|-----------|
| Cost | **$0** | $0 | $0 |
| Card needed | ❌ No | Depends on host | ❌ No |
| Always-on | ✅ Yes | ⚠️ Only when computer is on | N/A |
| Setup time | ~5 min | ~10 min | 0 min |
| Reliability | ⭐⭐⭐⭐⭐ (Cloudflare infra) | ⭐⭐⭐ | ❌ No AllAnime sources |
| Speed | ⭐⭐⭐⭐⭐ (Path A: ~2s, Path B: ~10s) | ⭐⭐⭐ (~15-30s) | N/A |

**This is the recommended path** if you have a Cloudflare account (free, no card needed).

## Prerequisites

- A Cloudflare account (free signup, no card needed)
- Node.js 18+ (for running wrangler)
- The `wrangler` CLI: `npm install -g wrangler`

## Deploy steps (5 min)

### 1. Login to Cloudflare

```bash
cd cf-worker
npm install          # installs @cloudflare/puppeteer for Browser Rendering
wrangler login       # opens browser — click "Allow" (no card needed)
```

### 2. Deploy

```bash
wrangler deploy
```

### 3. Copy the Worker URL

The deploy output will show:
```
Published xan-stream-proxy (x.xx sec)
  https://xan-stream-proxy.<your-subdomain>.workers.dev
```

Copy that URL.

### 4. Set the URL in XAN

Add to `/home/z/my-project/XAN/.env`:
```
NEXT_PUBLIC_CF_WORKER_URL=https://xan-stream-proxy.<your-subdomain>.workers.dev
```

### 5. Restart XAN

```bash
/home/z/my-project/scripts/xan-server.sh restart
```

### 6. Test it

```bash
# Direct test of the Worker
curl "https://xan-stream-proxy.<your-subdomain>.workers.dev/allanime/episode?showId=srGrP23qJnjsHrRYD&episodeString=1&translationType=sub"

# Through XAN
curl "http://localhost:3000/api/stream/5114/1?mode=sub"
# → should now include AllAnime sources alongside Zen/Koto
```

## How the direct crypto path works (Path A)

The breakthrough in v6: we load mkissa.to's SPA chunk directly in the Worker and call its own crypto functions.

```
1. Fetch mkissa.to home page → find entry chunk URLs
2. BFS-crawl chunks → find the one containing "VaildTranslationTypeEnumType" + "function tk"
3. Strip ES module imports/exports from the chunk
4. Execute the chunk in a sandboxed Function scope with browser stubs
5. Extract: tk, xk, Fy, Py, uk, ol, j7, mk, Ak, kk functions
6. Use tk() to compute x-aa-boot for the bootstrap endpoint
7. Use xk() to compute aaReq for the episode query
8. Use ol() to compute the query hash (SHA-256 of the query string)
9. Use Ak() to decrypt tobeparsed (if the new key fails, fall back to old key)
```

This approach is fragile (breaks if mkissa.to significantly restructures its
chunk), but the Worker self-heals:
- MASK/BUILD_ID are auto-discovered at runtime (crawls the bundle)
- The SPA chunk is re-fetched each time the Worker cold-starts
- If Path A fails for any reason, Path B (Browser Rendering) kicks in

## Browser Rendering fallback (Path B)

If Path A returns `NEED_CAPTCHA` (which happens when the Worker's IP is flagged),
the Worker falls back to Browser Rendering:

```javascript
// From worker.js:
if (directResult.needBrowser || directResult.error.includes("NEED_CAPTCHA")) {
  const browserResult = await fetchAllAnimeEpisodeViaBrowser(showId, ep, mode, env);
  // ...
}
```

Browser Rendering:
- Uses `@cloudflare/puppeteer` to launch managed Chrome
- Navigates to `mkissa.to/watch/<showId>/p-<ep>-<type>`
- The SPA handles ALL crypto + Turnstile automatically
- The Worker intercepts the bootstrap + episode responses
- Decrypts tobeparsed using the intercepted bootstrap's partB

**Free tier limits:** 10 min/day browser CPU. Each episode resolve takes ~10-15s.
With the 5-min response cache, you can resolve ~40 unique episodes/day before
hitting the limit. The cache helps a lot for repeat views.

## Self-healing

The Worker automatically handles mkissa.to changes:

| Change | How it's handled |
|--------|-----------------|
| MASK rotation | Auto-discovered from the SPA bundle at runtime |
| BUILD_ID bump | Auto-discovered from the SPA bundle at runtime |
| SPA chunk URL change | BFS-crawl finds the chunk by content, not URL |
| Query string change | The SPA's own `j7()` function is used — always current |
| `__aaCrypto` relocation | Bootstrap endpoint is called directly (not scraped from HTML) |
| New crypto scheme | Path B (Browser Rendering) runs the actual SPA — always works |

## Cost

**$0/month** — all on Cloudflare's free tier:
- Workers: 100,000 requests/day free
- Browser Rendering: 10 min/day free (enough for ~40 unique episodes/day with caching)
- No card required

## Troubleshooting

### "Browser Rendering not configured"

The `BROWSER` binding is missing from `wrangler.toml`. Make sure it has:
```toml
[browser]
binding = "BROWSER"
```

### Path A always returns NEED_CAPTCHA

This means Cloudflare Workers' IPs are being challenged by mkissa.to's Turnstile.
The Worker will automatically fall back to Path B (Browser Rendering). This is
expected behavior — Path A is an optimization, Path B is the reliable path.

### Path B times out

Browser Rendering may be slow or blocked. Try:
1. Wait a few minutes (rate limiting)
2. Check the Worker logs in the Cloudflare dashboard
3. Make sure you haven't exceeded the 10 min/day browser CPU limit

### "crypto chunk not found after crawling"

mkissa.to may have changed their chunk structure. Check:
1. Can you fetch `https://mkissa.to/` manually?
2. Do the entry chunks load?
3. Does any chunk contain `VaildTranslationTypeEnumType`?

If the chunk structure has changed, update the `loadSpaChunkFunctions()` function
in `worker.js` to match the new structure.

### Both paths fail

Fall back to the local free-solver (`free-solver/README.md`) which runs Puppeteer
on your own machine with a residential IP (more likely to pass Turnstile).

## Environment variables

Set these in your XAN `.env` (not the Worker):

| Variable | Example | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_CF_WORKER_URL` | `https://xan-stream-proxy.xxx.workers.dev` | The Worker URL from `wrangler deploy` |

The Worker itself doesn't need any environment variables — everything is auto-discovered.

## Updating

To update the Worker after pulling new code:

```bash
cd cf-worker
git pull
wrangler deploy
```

The MASK/BUILD_ID auto-refresh GitHub Action (`.github/workflows/refresh-mkissa-mask.yml`)
commits new values daily, but you don't need to redeploy for those — the Worker
auto-discovers them at runtime.
