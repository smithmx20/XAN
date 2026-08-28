# XAN Free Solver — AllAnime Episode Resolver

Resolves AllAnime episode sources for **$0** using Puppeteer + Stealth plugin.
Runs locally on any machine with Chrome installed.

## What changed (2026-08-29)

mkissa.to (formerly allmanga.to) has overhauled its crypto:
1. `__aaCrypto` is no longer in page HTML — it's fetched via a bootstrap API
   endpoint that requires an `x-aa-boot` header
2. Episode queries require a signed `aaReq` extension
3. Episode queries require a Cloudflare Turnstile token (`NEED_CAPTCHA`)

The good news: **mkissa.to's SPA handles ALL of this automatically** when loaded
in a real browser. This solver just:
1. Navigates to `https://mkissa.to/watch/<showId>/p-<ep>-<mode>`
2. Lets the SPA do its thing (bootstrap + crypto + Turnstile + episode query)
3. Intercepts the episode GraphQL response
4. Decrypts `tobeparsed` using the key derived from the intercepted bootstrap
5. Returns `sourceUrls` as JSON

No crypto code to maintain — the SPA does it all. We just intercept the result.

## Quick start

### Prerequisites

- Node.js 18+
- Chrome/Chromium (installed by Puppeteer automatically, or use system Chrome)

### Install & run

```bash
cd free-solver
npm install
npm run install-browser   # installs Chrome for Puppeteer
npm start                 # starts on port 3001
```

### Wire it into XAN

Add to `/home/z/my-project/XAN/.env`:
```
NEXT_PUBLIC_FREE_SOLVER_URL=http://localhost:3001
```

Restart the XAN dev server:
```bash
/home/z/my-project/scripts/xan-server.sh restart
```

### Test it

```bash
# Direct test
curl "http://localhost:3001/allanime/episode?showId=srGrP23qJnjsHrRYD&episodeString=1&translationType=sub"

# Through XAN
curl "http://localhost:3000/api/stream/5114/1?mode=sub"
# → should now include AllAnime sources alongside Zen/Koto
```

## How it works

```
XAN backend
    │
    │  GET /allanime/episode?showId=...&episodeString=1&translationType=sub
    ▼
free-solver (this server, port 3001)
    │
    │  1. Launch Puppeteer (stealth mode)
    │  2. Navigate to https://mkissa.to/watch/<showId>/p-1-sub
    │  3. SPA auto-runs:
    │     a. GET /client-crypto/v1/bootstrap → {epoch, partB}
    │     b. Compute x-aa-boot + aaReq
    │     c. POST episode GraphQL → NEED_CAPTCHA
    │     d. Render Turnstile widget → auto-solve (managed mode)
    │     e. Retry with Turnstile token → get tobeparsed
    │  4. Intercept bootstrap response → derive AES key
    │  5. Intercept episode response → decrypt tobeparsed
    │  6. Return sourceUrls
    ▼
XAN backend receives sources → merges with Zen/Koto/Pahe → returns to frontend
```

## Performance

- First request: ~15-30s (browser launch + page load + Turnstile solve)
- Cached requests: ~5ms (5-min cache TTL)
- Reliability: ~80-90% (Cloudflare may occasionally block — the stealth plugin
  handles most detection, but isn't perfect)

## Deployment options

### Option 1: Local machine (recommended for personal use)

Run on your laptop/desktop. The solver only runs while your computer is on.

```bash
cd free-solver && npm start
```

### Option 2: Local + Cloudflare Quick Tunnel (expose to Vercel)

If your XAN is deployed on Vercel, expose your local solver via Cloudflare's
free Quick Tunnel:

```bash
cd free-solver
./start-with-tunnel.sh   # starts solver + cloudflared tunnel
# → prints a URL like https://random-words-xxx.trycloudflare.com
# → set NEXT_PUBLIC_FREE_SOLVER_URL to that URL in Vercel
```

### Option 3: Always-on VPS

Deploy on any free/cheap VPS:
- **Render.com** free tier (GitHub signup, no card, sleeps after 15 min)
- **Oracle Cloud** always-free tier (card needed, 1GB RAM, always on)
- **Your own server** (best reliability)

```bash
git clone <xan-repo> && cd xan/free-solver
npm install
npm run install-browser
npm start
```

## Troubleshooting

### "browser launch failed"

Chrome isn't installed. Run:
```bash
npx puppeteer browsers install chrome
```

Or install system Chrome:
```bash
# Ubuntu/Debian
sudo apt install chromium-browser

# macOS
brew install chromium
```

### "no sources captured after 30000ms"

Cloudflare may have blocked the browser. Try:
1. Restart the solver (clears browser state)
2. Wait a few minutes (rate limiting)
3. Use a residential IP (datacenter IPs are more likely to be blocked)

### "Cloudflare challenge may not have passed"

The stealth plugin didn't fool Cloudflare. Try:
1. Update puppeteer-extra-plugin-stealth to latest
2. Use a non-headless browser (set `headless: false` in server.js)
3. Use a different IP

### Sources are empty but no error

The SPA may not have made the episode GraphQL call (e.g., invalid showId).
Check the solver logs for `[solver] intercepted GraphQL call #N` lines.

## API

### `GET /allanime/episode`

**Query params:**
- `showId` (required) — AllAnime show ID
- `episodeString` (required) — episode number (e.g., "1", "12.5")
- `translationType` — "sub" (default) or "dub"
- `secret` — required if `SOLVER_SECRET` env var is set

**Response (200):**
```json
{
  "sources": [
    { "sourceName": "S-mp4", "sourceUrl": "ap/...", "priority": 0, "type": "mp4" },
    ...
  ],
  "graphQLCalls": 2,
  "durationMs": 18432
}
```

**Response (502):**
```json
{
  "error": "Failed to capture sources — ...",
  "graphQLCalls": 0,
  "pageTitle": "Just a moment...",
  "bootstrapCaptured": false
}
```

### `GET /health`

```json
{
  "ok": true,
  "browser": true,
  "cacheSize": 3,
  "uptime": 3600,
  "memory": 234567890
}
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `SOLVER_SECRET` | (none) | Optional shared secret. If set, requests must include `?secret=` or `x-solver-secret` header |

## Cost

$0 — runs on any machine with Chrome installed.

The only ongoing cost is electricity (if running on your own machine) or VPS
cost (if using a cloud provider — Oracle Cloud's always-free tier is genuinely
free and sufficient).
