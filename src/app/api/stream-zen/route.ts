// app/api/stream-zen/route.ts
// ✅ CORS proxy for flixcloud.cc API
// ✅ flixcloud.cc is behind Cloudflare (returns 403 to direct browser fetches)
// ✅ Server-side fetch bypasses Cloudflare's browser challenge IF the caller
//    has good IP reputation (Cloudflare Workers, residential IPs, etc.).
//
// ⚠️ Vercel / Next.js dev server IPs often get 403'd by flixcloud.cc's
//    Cloudflare browser challenge. If the direct fetch fails with 403,
//    we transparently fall back to a public Cloudflare-Worker-backed
//    proxy (defaults to xancld.xyz, the public deployment of the XANCLD
//    worker which has Cloudflare's IP reputation and therefore passes
//    the challenge). Override with NEXT_PUBLIC_ZEN_PROXY_URL if you have
//    your own worker.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";

/**
 * Default public proxy fallback. xancld.xyz is the reference deployment of
 * the XANCLD Cloudflare Worker (https://github.com/smithP2007/XANCLD), which
 * runs on Cloudflare Workers Free tier and therefore has the IP reputation
 * needed to pass flixcloud.cc's Cloudflare browser challenge.
 *
 * Override with NEXT_PUBLIC_ZEN_PROXY_URL env var if you deploy your own.
 */
const DEFAULT_ZEN_PROXY_URL = "https://xancld.xyz";

function getZenProxyUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_ZEN_PROXY_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return DEFAULT_ZEN_PROXY_URL;
}

/**
 * Fetch from flixcloud.cc directly. Returns the parsed JSON on success,
 * or null if the fetch failed / returned non-200 / returned a Cloudflare
 * challenge page (which we detect by status 403).
 */
async function fetchDirect(
  anilistId: string,
  episode: string,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const upstreamUrl = `https://flixcloud.cc/videos/raw?anilist_id=${anilistId}&episode=${episode}`;
  try {
    const res = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Fetch via a Cloudflare-Worker-backed proxy. The proxy passes flixcloud.cc's
 * Cloudflare browser challenge because Worker IPs have good reputation.
 */
async function fetchViaProxy(
  anilistId: string,
  episode: string,
  proxyBaseUrl: string,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const proxyUrl = `${proxyBaseUrl}/api/stream-zen?anilistId=${encodeURIComponent(anilistId)}&episode=${encodeURIComponent(episode)}`;
  try {
    const res = await fetch(proxyUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

function buildOk(data: unknown) {
  return NextResponse.json(data, {
    status: 200,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store, max-age=0",
    },
  });
}

function buildError(status: number, message: string) {
  return NextResponse.json(
    { error: message, status: "error" },
    {
      status,
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}

export async function GET(request: Request) {
  const u = new URL(request.url);
  const anilistId = u.searchParams.get("anilistId");
  const episode = u.searchParams.get("episode");

  if (!anilistId || !episode) {
    return buildError(400, "Missing anilistId or episode parameter");
  }

  // ─── 1. Try flixcloud.cc directly ───
  const direct = await fetchDirect(anilistId, episode);
  if (direct.ok) {
    return buildOk(direct.data);
  }

  // ─── 2. On 403 (Cloudflare challenge) or other failure, fall back to proxy ───
  // 403 is the most common failure — flixcloud.cc's Cloudflare browser challenge
  // blocks non-Worker IPs. Other failures (timeouts, 5xx) are also worth retrying
  // through the proxy.
  const proxyUrl = getZenProxyUrl();
  if (proxyUrl) {
    console.log(
      `[stream-zen] direct fetch failed (status ${direct.status}); falling back to proxy ${proxyUrl}`,
    );
    const proxied = await fetchViaProxy(anilistId, episode, proxyUrl);
    if (proxied.ok) {
      return buildOk(proxied.data);
    }
    return buildError(
      502,
      `Both direct and proxy fetch failed. Direct status: ${direct.status}, proxy status: ${proxied.status}`,
    );
  }

  // No proxy configured — return the original direct-fetch error.
  return buildError(502, `Upstream returned ${direct.status}`);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}
