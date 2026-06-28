# XAN Stream Proxy — Cloudflare Worker

External proxy that offloads video streaming bandwidth from Vercel to
Cloudflare's free tier. Eliminates the ~10% of streams that currently
fall back to `/api/proxy_stream` (which eats your Vercel 10GB/mo quota).

## Why this exists

Browsers can't set `Referer` or `Origin` headers on `<video>` tags or
`fetch()` (they're "forbidden headers" per the Fetch spec). So when an
anime CDN enforces `Referer: https://youtu-chan.com`, the browser gets
a 403/404. Only a server can set those headers.

Vercel CAN do it (our `/api/proxy_stream` does), but every byte flows
through Vercel → eats your 10GB/mo quota.

Cloudflare Workers can do the same thing on the **free tier**:
- 100,000 requests/day
- Unlimited bandwidth
- Globally distributed (low latency)

A 24-min HLS episode ≈ 500-1000 `.ts` segments → ~100-200 episodes/day
on the free tier. Way more than enough for a hobby project.

## Deploy (one-time, ~5 minutes)

### 1. Install wrangler CLI

```bash
npm install -g wrangler
# or: bun add -g wrangler
```

### 2. Log in to Cloudflare

```bash
wrangler login
```

This opens a browser tab for OAuth. Click "Allow". Done.

### 3. Deploy the Worker

```bash
cd cf-worker
wrangler deploy
```

Output will look like:

```
Published xan-stream-proxy
  https://xan-stream-proxy.<your-subdomain>.workers.dev
```

**Copy that URL** — you'll need it in step 4.

### 4. Add the URL to Vercel

Go to your Vercel project → Settings → Environment Variables → Add:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_CF_WORKER_URL` | `https://xan-stream-proxy.<your-subdomain>.workers.dev` | Production, Preview, Development |

The `NEXT_PUBLIC_` prefix makes it available in the browser (client-side).

### 5. Redeploy Vercel

Push any commit to `main` (or click "Redeploy" in Vercel). The player
will now try the CF Worker as Tier 2.5 before falling back to Vercel's
full-proxy.

### 6. Verify

1. Open the app → play any episode
2. Look at the badge in the player's top bar:
   - **CF** (cyan) = Worker is handling the stream — 0 Vercel bandwidth
   - **PROXIED** (amber) = Worker failed/skipped, Vercel is handling it
3. Open Settings → Bandwidth → Stream tier analytics to see per-provider
   tier distribution. The "CF-PROXY" column counts Worker usage.

## How it works

### URL format (called by the player)

```
https://xan-stream-proxy.<subdomain>.workers.dev/?url=<encoded_stream_url>&h_Referer=<...>&h_Origin=<...>
```

The `h_` prefix is stripped and the rest becomes a request header on
the upstream fetch. This lets the Worker set forbidden headers like
`Referer` that browsers cannot set themselves.

### What the Worker does

1. Parses `?url=` and `?h_*` query params
2. Validates the host against `ALLOWED_HOSTS` (security — prevents
   open-proxy abuse)
3. Builds upstream headers (User-Agent + custom headers from `h_*`)
4. Forwards client `Range` header (for video seeking)
5. `fetch()`s the upstream URL with those headers
6. Streams the response body back to the browser with CORS headers
7. Returns appropriate error responses for invalid requests

### Where it fits in the player's tier cascade

```
Tier 1   DIRECT          → 0 Vercel BW (browser → CDN direct)
Tier 2   MANIFEST-PROXY  → ~5KB Vercel BW (Vercel fetches .m3u8 only,
                         │  segments go direct from CDN)
Tier 2.5 CF-PROXY        → 0 Vercel BW (CF Worker fetches everything
                         │  with Referer/Origin headers, streams back)
Tier 3   FULL-PROXY      → ~200MB Vercel BW (final fallback if Worker
                           is down or rate-limited)
```

The player tries tiers in order and auto-falls-back on errors. If you
don't set `NEXT_PUBLIC_CF_WORKER_URL`, Tier 2.5 is silently skipped
and the cascade goes Tier 2 → Tier 3 (current behavior).

## Security

- **Host allowlist**: the Worker only proxies requests to known anime
  provider CDNs (`tools.fast4speed.rsvp`, `megacloud.tv`, etc.). This
  prevents abuse as an open proxy.
- **No request body handling**: GET-only, no POST/PUT.
- **No cookies/credentials forwarded**: the Worker doesn't see or
  forward any user credentials.
- **CORS `*`**: allows any origin to use the Worker. This is fine
  because the host allowlist prevents abuse. If you want to lock it
  down to only your domain, replace `"*"` with your Vercel URL in
  `CORS_HEADERS` inside `worker.js`.

## Monitoring

- **Worker analytics**: Cloudflare dashboard → Workers → xan-stream-proxy
  → Metrics. Shows requests, CPU time, errors.
- **Real-time logs**: `wrangler tail` streams live logs from the Worker.
- **App-side analytics**: Settings → Bandwidth → Stream tier analytics
  shows how often the CF tier is being used per provider.

## Limits (free tier)

| Resource | Limit | Notes |
|---|---|---|
| Requests/day | 100,000 | ~100-200 episodes/day |
| CPU time/request | 10ms | Plenty — we're just streaming |
| Bandwidth | Unlimited | The whole point |
| Subrequests | 50 per request | We make 1 — well under |
| Script size | 1MB | Ours is ~3KB |

If you outgrow the free tier, Cloudflare Workers Paid is $5/mo for
10M requests/day with no bandwidth cap.

## Troubleshooting

**Worker returns 403 "Host not allowed"**
The stream URL's host isn't in `ALLOWED_HOSTS` in `worker.js`. Add it
and redeploy with `wrangler deploy`.

**Worker returns 502 "Unknown proxy error"**
The upstream fetch failed — could be a network blip, the provider
blocking Cloudflare IPs, or a malformed URL. Check `wrangler tail` for
details. The player will auto-fall-back to Vercel's full-proxy.

**Streams still show PROXIED (amber) badge instead of CF (cyan)**
Either `NEXT_PUBLIC_CF_WORKER_URL` isn't set in Vercel, or the env var
hasn't propagated yet. Verify in Vercel → Settings → Environment
Variables, then redeploy.

**Rate limited (HTTP 429 from Cloudflare)**
You've hit the 100k/day free tier cap. Either upgrade to Workers Paid
($5/mo) or let the player fall back to Vercel for the overflow.

## Local development

You can run the Worker locally for testing:

```bash
cd cf-worker
wrangler dev
```

This starts a local server at `http://localhost:8787`. Set
`NEXT_PUBLIC_CF_WORKER_URL=http://localhost:8787` in your `.env.local`
to test against it.

## Files

- `worker.js` — the Worker code (single file, ~150 lines)
- `wrangler.toml` — Cloudflare Workers config
- `README.md` — this file
