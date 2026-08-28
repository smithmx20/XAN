# Deploying the AllAnime Solver for XAN on Vercel (xan.co.in)

Since XAN is deployed on Vercel, Vercel's servers need to reach your solver
over the public internet. `localhost:3001` won't work — Vercel can't access
your local machine directly.

You have **two options**. Pick one (or both for redundancy):

---

## Option A — Deploy the Cloudflare Worker (recommended)

**Best for:** always-on access, no computer to leave running, most reliable

The Worker runs on Cloudflare's own IPs, which Cloudflare's bot detection
trusts. It handles mkissa.to's full crypto + Turnstile flow server-side.

### Prerequisites
- A Cloudflare account (free, no card needed — signup at cloudflare.com)
- Node.js 18+ installed on your computer
- A terminal/command prompt

### Step-by-step

#### 1. Clone the repo (if not already done)

```bash
git clone https://github.com/sundeepyt2/XAN.git
cd XAN/cf-worker
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Install wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
```

#### 4. Login to Cloudflare

```bash
wrangler login
```

This opens your browser. Click **"Allow"**. No card needed, no payment info
asked. You just need a free Cloudflare account.

Verify you're logged in:
```bash
wrangler whoami
```

#### 5. Deploy the Worker

```bash
wrangler deploy
```

Output will look like:
```
Published xan-stream-proxy (1.23 sec)
  https://xan-stream-proxy.your-subdomain.workers.dev
```

**Copy that URL** — you'll need it in the next step.

#### 6. Add the URL to Vercel

1. Go to [vercel.com](https://vercel.com) → your XAN project
2. **Settings** → **Environment Variables**
3. Add a new variable:
   - **Key:** `NEXT_PUBLIC_CF_WORKER_URL`
   - **Value:** `https://xan-stream-proxy.your-subdomain.workers.dev`
   - **Environment:** Production (and Preview if you want)
4. Click **Save**

#### 7. Redeploy Vercel

Environment variable changes require a redeploy:
1. Go to **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Select **Redeploy**
4. Wait ~2 min for the build to finish

#### 8. Test it

Visit any anime episode page on xan.co.in and check the source switcher —
you should now see AllAnime sources alongside Zen/Koto.

To verify directly:
```bash
curl "https://xan-stream-proxy.your-subdomain.workers.dev/allanime/episode?showId=srGrP23qJnjsHrRYD&episodeString=1&translationType=sub"
# → should return {"sources":[...]} after 2-15 seconds
```

### Cost
**$0/month** — all on Cloudflare's free tier:
- Workers: 100,000 requests/day free
- Browser Rendering: 10 min/day free (enough for ~40 unique episodes/day with caching)

### Updating
When you pull new code from the XAN repo:
```bash
cd XAN/cf-worker
git pull
wrangler deploy
```

---

## Option B — Run the free-solver on your home computer

**Best for:** unlimited solves (no 10 min/day browser limit), zero signup,
but requires your computer to be on while watching anime

The free-solver runs Puppeteer (headless Chrome) on **your** computer. Your
residential IP is trusted by Cloudflare's bot detection (unlike datacenter IPs).
A Cloudflare Quick Tunnel exposes it to the internet so Vercel can reach it.

### Prerequisites
- A computer you can leave running while watching anime (laptop/desktop)
- Node.js 18+ (install from nodejs.org)
- Chrome will be auto-installed by Puppeteer (~150MB)

### Step-by-step

#### 1. Clone the repo to your home computer

```bash
git clone https://github.com/sundeepyt2/XAN.git
cd XAN/free-solver
```

#### 2. Run the one-command startup script

```bash
./start-with-tunnel.sh
```

This script automatically:
1. Installs npm dependencies
2. Downloads Chrome (if not already installed)
3. Installs `cloudflared` (Cloudflare's tunnel client)
4. Starts the solver on port 3001
5. Starts a Cloudflare Quick Tunnel — creates a **public HTTPS URL** that
   forwards to your local solver
6. Prints the URL

Output will look like:
```
═══════════════════════════════════════════════════════════════
  ✓ Solver is live!
═══════════════════════════════════════════════════════════════

Public URL:
  https://random-words-xxx.trycloudflare.com

Health check:
  https://random-words-xxx.trycloudflare.com/health

── Next steps ──
  1. Copy the Public URL above
  2. Go to Vercel → your XAN project → Settings → Environment Variables
  3. Add: NEXT_PUBLIC_FREE_SOLVER_URL = https://random-words-xxx.trycloudflare.com
  4. Redeploy Vercel
  5. Play any episode on your XAN site — AllAnime sources will appear

⚠ Keep this terminal open while watching anime.
  Closing it stops the solver + tunnel.
```

#### 3. Add the tunnel URL to Vercel

1. Copy the `https://random-words-xxx.trycloudflare.com` URL
2. Go to [vercel.com](https://vercel.com) → your XAN project
3. **Settings** → **Environment Variables**
4. Add a new variable:
   - **Key:** `NEXT_PUBLIC_FREE_SOLVER_URL`
   - **Value:** `https://random-words-xxx.trycloudflare.com`
   - **Environment:** Production
5. Click **Save**

#### 4. Redeploy Vercel

1. **Deployments** tab → **⋯** on latest → **Redeploy**
2. Wait ~2 min

#### 5. Test it

```bash
# Test the tunnel directly
curl "https://random-words-xxx.trycloudflare.com/health"
# → {"ok":true,"browser":true,...}

curl "https://random-words-xxx.trycloudflare.com/allanime/episode?showId=srGrP23qJnjsHrRYD&episodeString=1&translationType=sub"
# → {"sources":[...]} after ~15-30 seconds
```

Then visit any episode page on xan.co.in — AllAnime sources should appear.

### Cost
**$0/month** — runs on your own computer, Cloudflare Quick Tunnel is free.

### Important caveats

⚠ **Keep the terminal open**: Closing the terminal (or pressing Ctrl+C) stops
both the solver and the tunnel. AllAnime sources will stop working immediately.

⚠ **The URL changes on restart**: Each time you run `./start-with-tunnel.sh`,
you get a new random URL. You'll need to update the Vercel env var each time.
For a **stable URL** (same URL every restart), see the "Stable URL" section
below.

⚠ **Computer must be on**: If your computer sleeps/shuts down, the solver
stops. AllAnime sources will fail silently (XAN falls back to Zen/Koto).

### Getting a stable URL (optional, recommended)

Quick Tunnel URLs are random. For a permanent URL that doesn't change:

1. Create a free Cloudflare account (if you don't have one)
2. Install cloudflared: `brew install cloudflared` (macOS) or download from
   [github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases)
3. Login: `cloudflared tunnel login`
4. Create a named tunnel: `cloudflared tunnel create xan-solver`
5. Configure DNS: `cloudflared tunnel route dns xan-solver solver.yourdomain.com`
6. Edit `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: xan-solver
   credentials-file: /root/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: solver.yourdomain.com
       service: http://localhost:3001
     - service: http_status:404
   ```
7. Start: `cloudflared tunnel run xan-solver`

Now `https://solver.yourdomain.com` always points to your solver, even after
restarts. You need a domain on Cloudflare (free with any domain registrar).

---

## Both options (maximum reliability)

Set **both** env vars in Vercel:
```
NEXT_PUBLIC_FREE_SOLVER_URL=https://random-words-xxx.trycloudflare.com
NEXT_PUBLIC_CF_WORKER_URL=https://xan-stream-proxy.your-subdomain.workers.dev
```

XAN will try the free-solver first (faster, unlimited solves), and fall back
to the cf-worker if your computer is off or the tunnel is down.

---

## Which option should I pick?

| | Option A (cf-worker) | Option B (home solver) |
|---|---|---|
| **Setup time** | ~5 min | ~5 min |
| **Cost** | $0 | $0 |
| **Card needed** | No | No |
| **Always-on** | ✅ Yes (Cloudflare runs it) | ❌ Only when computer is on |
| **Solve limit** | 10 min/day browser CPU (~40 eps/day) | ♾️ Unlimited |
| **Speed** | Fast (Path A: ~2s, Path B: ~10s) | Slower (~15-30s) |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ (depends on your computer + internet) |
| **URL stability** | ✅ Always the same | ❌ Changes on restart (unless you set up a named tunnel) |

**Recommendation:** Start with **Option A** (cf-worker). It's the most reliable
and requires nothing from you after the initial 5-minute setup. If you hit the
10 min/day browser limit (watching 40+ unique episodes per day), add Option B
as well for unlimited solves.

---

## Troubleshooting

### Vercel env var not taking effect
Environment variable changes need a **redeploy**. Go to Deployments → ⋯ → Redeploy.

### "ECONNREFUSED" in XAN logs
The solver isn't running or the URL is wrong. Check:
- Is the solver running? (`curl http://localhost:3001/health` locally)
- Is the tunnel URL correct in Vercel env vars?
- Did you redeploy Vercel after changing env vars?

### AllAnime sources still missing after setup
Check the XAN logs (Vercel → Functions → Logs) for:
- `[AllAnime] NEED_CAPTCHA — falling back to...` → routing is working
- `[AllAnime] calling cf-worker: https://...` or `calling free-solver: https://...` → solver is being called
- Solver errors → check the solver's own logs

### cf-worker returns 502
The worker's Path A (direct crypto) hit NEED_CAPTCHA and Path B (Browser
Rendering) also failed. Check:
- Is the `BROWSER` binding in `wrangler.toml`? (it should be by default)
- Have you exceeded the 10 min/day browser CPU limit?

### Free-solver times out
Your residential IP might be temporarily rate-limited by Cloudflare. Wait
10-15 min and try again. If it persists, restart the solver.
