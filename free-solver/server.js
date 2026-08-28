// free-solver/server.js
//
// XAN AllAnime Episode Resolver — local Puppeteer-based solver
//
// UPDATED (2026-08-29) for mkissa.to's new crypto scheme:
//   - Navigates to mkissa.to/watch/... (not allmanga.to/bangumi/...)
//   - Intercepts BOTH the bootstrap response AND the episode GraphQL response
//   - Derives the AES key from bootstrap's partB + the SPA's MASK
//   - Falls back to the OLD key (sha256("Xot36i3lK3:v1")) if new key fails
//
// How it works:
//   1. XAN calls: GET /allanime/episode?showId=...&episodeString=...&translationType=sub
//   2. Server launches Chrome (or reuses existing instance) with stealth flags
//   3. Navigates to https://mkissa.to/watch/<showId>/p-<ep>-<type>
//   4. The SPA automatically:
//      a. Calls /client-crypto/v1/bootstrap → gets {epoch, partB}
//      b. Computes x-aa-boot + aaReq (all client-side)
//      c. Calls the episode GraphQL → may get NEED_CAPTCHA
//      d. If NEED_CAPTCHA: renders Turnstile widget (auto-solves in managed mode)
//      e. Retries the episode GraphQL with the Turnstile token
//      f. Gets tobeparsed (encrypted sourceUrls) or cleartext sourceUrls
//   5. Server intercepts the bootstrap + episode responses
//   6. Derives AES key = XOR(atob(partB), hexToBytes(MASK))
//   7. Decrypts tobeparsed → sourceUrls
//   8. Returns sourceUrls to XAN as JSON
//
// Cost: $0 (runs on any machine with Chrome installed)
// Performance: ~15-30s per request (first call), ~5s cached
// Reliability: ~80-90% (Cloudflare may occasionally block — retry handles this)

const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const crypto = require("crypto");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;
const SOLVER_SECRET = process.env.SOLVER_SECRET || "";

// ─── mkissa.to MASK — auto-refreshed by the upstream repo's GitHub Action ──
// This is used to derive the AES decryption key from the bootstrap's partB.
// If this is stale, decryption will fail and we'll fall back to the OLD key.
const MASK_HEX = "5414eefc1e322ad6c1ebd577813fdace8add468a78e679efed2a7191ac07f337";
const OLD_KEY_STR = "Xot36i3lK3:v1";

// ─── Browser pool ───────────────────────────────────────────────────────────
let browser = null;
let browserLaunchPromise = null;

async function getBrowser() {
  if (browser && browser.connected) {
    try {
      await browser.pages();
      return browser;
    } catch {
      browser = null;
    }
  }
  if (browserLaunchPromise) return browserLaunchPromise;

  browserLaunchPromise = (async () => {
    console.log("[solver] launching browser...");
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-ipc-fpike",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1280,800",
      ],
      defaultViewport: { width: 1280, height: 800 },
    });
    browser.on("disconnected", () => {
      console.warn("[solver] browser disconnected — will relaunch on next request");
      browser = null;
      browserLaunchPromise = null;
    });
    console.log("[solver] browser ready");
    browserLaunchPromise = null;
    return browser;
  })();
  return browserLaunchPromise;
}

// ─── AES-GCM decryption ─────────────────────────────────────────────────────
// Tries the NEW key (derived from bootstrap partB + MASK) first,
// falls back to the OLD key (sha256("Xot36i3lK3:v1")).

function decryptTobeparsed(b64, newKeyBytes) {
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 32 || buf[0] !== 1) return null;

    const iv = buf.subarray(1, 13);
    const ctWithTag = buf.subarray(13);
    const tag = ctWithTag.subarray(ctWithTag.length - 16);
    const ciphertext = ctWithTag.subarray(0, ctWithTag.length - 16);

    // Try NEW key first (if provided)
    if (newKeyBytes) {
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", newKeyBytes, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return JSON.parse(plaintext.toString("utf-8"));
      } catch {
        // fall through to old key
      }
    }

    // Fallback: OLD key
    const oldKey = crypto.createHash("sha256").update(OLD_KEY_STR).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", oldKey, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf-8"));
  } catch (err) {
    console.error("[solver] decryptTobeparsed failed:", err.message);
    return null;
  }
}

// Derive the NEW AES key: XOR(atob(partB), hexToBytes(MASK))
function deriveAesKey(partB) {
  const maskBytes = Buffer.from(MASK_HEX, "hex");
  const partBBytes = Buffer.from(partB, "base64");
  if (partBBytes.length < 32) throw new Error("partB too short");
  const keyBytes = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = partBBytes[i] ^ maskBytes[i % maskBytes.length];
  }
  return keyBytes;
}

// ─── In-memory cache ────────────────────────────────────────────────────────
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.sources;
  if (cached) responseCache.delete(key);
  return null;
}

function setCached(key, sources) {
  responseCache.set(key, { sources, expiresAt: Date.now() + CACHE_TTL_MS });
  if (responseCache.size > 100) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
}

// ─── Main endpoint ──────────────────────────────────────────────────────────

app.get("/allanime/episode", async (req, res) => {
  if (SOLVER_SECRET) {
    const provided = req.query.secret || req.headers["x-solver-secret"];
    if (provided !== SOLVER_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { showId, episodeString, translationType } = req.query;
  if (!showId || !episodeString) {
    return res.status(400).json({ error: "Missing showId or episodeString" });
  }
  const mode = translationType === "dub" ? "dub" : "sub";

  const cacheKey = `${showId}:${episodeString}:${mode}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[solver] cache hit for ${cacheKey} (${cached.length} sources)`);
    return res.json({ sources: cached, cached: true });
  }

  console.log(`[solver] resolving ${cacheKey}`);

  let page;
  let context;
  try {
    const br = await getBrowser();
    // Puppeteer v23+ renamed createIncognitoBrowserContext → createBrowserContext
    context = br.createBrowserContext
      ? await br.createBrowserContext()
      : await br.createIncognitoBrowserContext();
    page = await context.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    let sources = null;
    let bootstrapData = null;
    let aesKeyBytes = null;
    let graphQLCallCount = 0;

    // Intercept mkissa.to API responses
    page.on("response", async (response) => {
      const url = response.url();
      try {
        // Bootstrap response — gives us {epoch, partB}
        if (url.includes("client-crypto/v1/bootstrap") && response.ok()) {
          const json = await response.json();
          if (json.partB && json.epoch) {
            bootstrapData = json;
            aesKeyBytes = deriveAesKey(json.partB);
            console.log(`[solver] intercepted bootstrap: epoch=${json.epoch}, partB length=${json.partB.length}`);
          }
        }

        // Episode GraphQL response — api.allanime.day/api or api.mkissa.net/api
        if ((url.includes("api.allanime.day/api") || url.includes("api.mkissa.net/api")) && response.ok()) {
          graphQLCallCount++;
          console.log(`[solver] intercepted GraphQL call #${graphQLCallCount}: ${response.status()} ${url.slice(0, 80)}...`);

          const text = await response.text();
          if (!text.includes("sourceUrls") && !text.includes("tobeparsed")) return;

          const json = JSON.parse(text);

          if (json.data?.tobeparsed) {
            const decrypted = decryptTobeparsed(json.data.tobeparsed, aesKeyBytes);
            if (decrypted?.episode?.sourceUrls) {
              sources = decrypted.episode.sourceUrls;
              console.log(`[solver] decrypted tobeparsed — ${sources.length} sources`);
            } else {
              console.warn("[solver] tobeparsed decrypted but no sourceUrls");
            }
          } else if (json.data?.episode?.sourceUrls) {
            sources = json.data.episode.sourceUrls;
            console.log(`[solver] got cleartext sourceUrls — ${sources.length} sources`);
          }
        }
      } catch (e) {
        // response.json()/text() can fail if already consumed or not JSON
      }
    });

    // ─── Step 1: Navigate to home page first to pass Cloudflare's challenge ───
    // Direct navigation to /anime/<id>/p-<ep>-<mode> gets stuck on Cloudflare's
    // "Just a moment..." challenge. The home page loads without a challenge,
    // and once the SPA is hydrated + cf_clearance cookie is set, we can
    // SPA-navigate to the episode page without triggering a fresh challenge.
    console.log("[solver] navigating to mkissa.to home page first");
    try {
      await page.goto("https://mkissa.to/", { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (err) {
      console.warn(`[solver] home page goto error: ${err.message}`);
    }

    // Wait for Cloudflare challenge to pass on home page
    try {
      await page.waitForFunction(
        () => document.title !== "Just a moment..." && !document.title.includes("Just a moment"),
        { timeout: 30000 },
      );
      console.log("[solver] home page loaded — title:", await page.title());
    } catch {
      console.warn("[solver] home page challenge didn't pass — title:", await page.title().catch(() => "unknown"));
    }

    // Wait for SPA to hydrate (SvelteKit needs time to load + render)
    await new Promise((r) => setTimeout(r, 3000));

    // ─── Step 2: SPA-navigate to the episode page ───
    // This doesn't trigger a fresh Cloudflare challenge because the browser
    // already has the cf_clearance cookie from the home page load.
    const episodeUrl = `https://mkissa.to/anime/${showId}/p-${episodeString}-${mode}`;
    console.log(`[solver] SPA-navigating to ${episodeUrl}`);
    try {
      await page.goto(episodeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (err) {
      console.warn(`[solver] episode page goto error: ${err.message}`);
    }

    // Wait for any Cloudflare challenge to pass
    try {
      await page.waitForFunction(
        () => document.title !== "Just a moment..." && !document.title.includes("Just a moment"),
        { timeout: 30000 },
      );
    } catch {}

    // Debug: print the final URL and check for Turnstile
    console.log(`[solver] final URL: ${page.url()}`);
    console.log(`[solver] page title: ${await page.title().catch(() => "unknown")}`);

    // Take a screenshot
    await page.screenshot({ path: "/tmp/mkissa-episode-page.png", fullPage: false }).catch(() => {});

    // Check for Turnstile iframe
    const turnstileFrames = page.frames().filter((f) => f.url().includes("challenges.cloudflare.com"));
    console.log(`[solver] Turnstile iframes: ${turnstileFrames.length}`);

    // Check page content for clues
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || "").catch(() => "");
    console.log(`[solver] body text preview: ${bodyText.slice(0, 200)}`);

    // Wait for sources to be captured (SPA auto-fetches after Turnstile solves)
    const maxWaitMs = 60000;
    const startWait = Date.now();
    while (!sources && Date.now() - startWait < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 1000));
      if ((Date.now() - startWait) % 10000 < 1000) {
        const ts = page.frames().filter((f) => f.url().includes("challenges.cloudflare.com")).length;
        console.log(`[solver] waiting... ${Math.floor((Date.now() - startWait) / 1000)}s elapsed, ${graphQLCallCount} GraphQL calls, ${ts} Turnstile iframes`);
      }
    }

    if (sources && sources.length > 0) {
      console.log(`[solver] success — ${sources.length} sources in ${Date.now() - startWait}ms`);
      setCached(cacheKey, sources);
      res.json({
        sources,
        graphQLCalls: graphQLCallCount,
        durationMs: Date.now() - startWait,
      });
    } else {
      console.warn(`[solver] no sources after ${maxWaitMs}ms (${graphQLCallCount} GraphQL calls)`);
      res.status(502).json({
        error: "Failed to capture sources — Cloudflare may have blocked the browser or Turnstile didn't auto-solve",
        graphQLCalls: graphQLCallCount,
        pageTitle: await page.title().catch(() => "unknown"),
        bootstrapCaptured: !!bootstrapData,
      });
    }
  } catch (err) {
    console.error("[solver] unexpected error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (context) {
      try { await context.close(); } catch {}
    }
  }
});

// ─── Health check ───────────────────────────────────────────────────────────

app.get("/health", async (req, res) => {
  res.json({
    ok: true,
    browser: browser?.connected ?? false,
    cacheSize: responseCache.size,
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
  });
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────

process.on("SIGTERM", async () => {
  console.log("[solver] SIGTERM — closing browser...");
  if (browser) await browser.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  console.log("[solver] SIGINT — closing browser...");
  if (browser) await browser.close();
  process.exit(0);
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`[solver] XAN free-solver listening on port ${PORT}`);
  console.log(`[solver] endpoint: GET /allanime/episode?showId=...&episodeString=...&translationType=sub|dub`);
  console.log(`[solver] target site: https://mkissa.to/watch/<showId>/p-<ep>-<sub|dub>`);
  if (SOLVER_SECRET) {
    console.log("[solver] SOLVER_SECRET set — requests must include ?secret= or x-solver-secret header");
  }
  getBrowser().catch((err) => {
    console.error("[solver] initial browser launch failed:", err.message);
    console.error("[solver] install Chrome with: npx puppeteer browsers install chrome");
  });
});
