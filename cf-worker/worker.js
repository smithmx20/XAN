// cf-worker/worker.js
//
// XAN External Stream Proxy — Cloudflare Worker
//
// ✅ Runs on Cloudflare Workers FREE tier (100k req/day, unlimited bandwidth)
// ✅ Replaces Vercel's /api/proxy_stream for Referer-enforced streams
// ✅ Sets Referer/Origin headers on the upstream fetch (browsers can't)
// ✅ Streams the response body back (no body size limit)
// ✅ Supports HTTP Range requests (essential for video seeking)
// ✅ Host allowlist — only proxies known anime provider CDNs
// ✅ CORS headers — browser can fetch cross-origin
//
// Deploy:
//   1. npm install -g wrangler
//   2. wrangler login   (opens browser for OAuth)
//   3. cd cf-worker && wrangler deploy
//   4. Copy the resulting URL (https://xan-stream-proxy.<subdomain>.workers.dev)
//   5. Set NEXT_PUBLIC_CF_WORKER_URL in your Vercel project env vars
//   6. Redeploy Vercel
//
// URL format (called by the player):
//   https://xan-stream-proxy.<subdomain>.workers.dev/?url=<encoded_stream_url>&h_Referer=<...>&h_Origin=<...>
//
// The h_ prefix is stripped and the rest becomes a request header on the
// upstream fetch. This lets the Worker set forbidden headers like Referer
// that browsers cannot set themselves.

const ALLOWED_HOSTS = [
  "tools.fast4speed.rsvp",
  "megacloud.tv",
  "vixcloud.co",
  "youtu-chan.com",
  "allanime.day",
  "allanime.uns.bio",
  "mp4upload.com",
  "bysekoze.com",
  "vidnest.io",
  "ok.ru",
  "repackager.wixmp.com",
  "allanimenews.com",
  "sharepoint.com",
];

function isAllowedHost(urlStr) {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
  "etag",
  "last-modified",
];

const FORWARD_REQUEST_HEADERS = ["range", "if-range", "if-modified-since"];

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "range",
  "access-control-expose-headers": "content-length, content-range, content-type",
};

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ─── CORS preflight ───
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "range, content-type, if-range, if-modified-since",
          "access-control-max-age": "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return jsonError("Method not allowed — use GET", 405);
    }

    // ─── Health check (hit the root with no ?url= param) ───
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "xan-stream-proxy",
          version: 1,
          message: "Cloudflare Worker proxy for XAN. Pass ?url=<stream_url> to proxy a request.",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        },
      );
    }

    // ─── Host allowlist ───
    if (!isAllowedHost(target)) {
      return jsonError("Host not allowed by proxy allowlist", 403);
    }

    // ─── Build upstream request headers ───
    // Custom headers come in as h_Referer, h_Origin, etc.
    const customHeaders = {};
    url.searchParams.forEach((v, k) => {
      if (k.startsWith("h_")) {
        customHeaders[k.slice(2)] = v;
      }
    });

    const upstreamHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0",
      Accept: "*/*",
      ...customHeaders,
    };

    // Forward Range / conditional-fetch headers from the client (for seeking)
    for (const h of FORWARD_REQUEST_HEADERS) {
      const v = request.headers.get(h);
      if (v) upstreamHeaders[h] = v;
    }

    // ─── Fetch upstream ───
    try {
      const upstream = await fetch(target, {
        headers: upstreamHeaders,
        redirect: "follow",
      });

      // ─── Build response headers ───
      const respHeaders = new Headers(CORS_HEADERS);
      for (const h of FORWARD_RESPONSE_HEADERS) {
        const v = upstream.headers.get(h);
        if (v) respHeaders.set(h, v);
      }

      // Fix content-type for MP4 streams that come back as octet-stream
      const contentType = upstream.headers.get("content-type") ?? "";
      const urlLower = target.toLowerCase();
      if (
        (contentType.includes("octet-stream") || !contentType) &&
        (urlLower.includes(".mp4") || urlLower.includes("/media"))
      ) {
        respHeaders.set("content-type", "video/mp4");
      }

      // ─── Stream the response body back to the browser ───
      // Workers support streaming — upstream.body is a ReadableStream that
      // gets piped through without buffering the whole video in memory.
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      const msg = err && err.message ? err.message : "Unknown proxy error";
      return jsonError(msg, 502);
    }
  },
};
