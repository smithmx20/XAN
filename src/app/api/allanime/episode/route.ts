// app/api/allanime/episode/route.ts
// ✅ AllAnime episode resolver — implements the mkissa.to AES-GCM crypto scheme
//    so we don't need an external CF Worker or free-solver to get past the
//    AA_CRYPTO_MISSING error that AllAnime returns for unsigned queries.
//
// Ported from https://github.com/smithP2007/XANCLD/blob/main/src/worker/index.ts
// (the /api/allanime/episode Hono route) — see src/lib/allanime-crypto.ts for
// the actual crypto implementation.

import { NextResponse } from "next/server";
import { fetchAllAnimeEpisodeDirect } from "@/lib/allanime-crypto";

export const dynamic = "force-dynamic";
// Vercel Hobby max is 60s. The crypto route does ~2 fetches to mkissa.to +
// api.allanime.day, plus SHA-256 + AES-GCM — usually 1-3s, but allow headroom
// for slow upstream responses.
export const maxDuration = 30;

export async function GET(request: Request) {
  const u = new URL(request.url);
  const showId = u.searchParams.get("showId");
  const episodeString = u.searchParams.get("episodeString");
  const translationType = (u.searchParams.get("translationType") || "sub") as
    | "sub"
    | "dub";

  if (!showId || !episodeString) {
    return NextResponse.json(
      { error: "Missing showId or episodeString" },
      { status: 400 },
    );
  }
  if (translationType !== "sub" && translationType !== "dub") {
    return NextResponse.json(
      { error: "translationType must be 'sub' or 'dub'" },
      { status: 400 },
    );
  }

  const result = await fetchAllAnimeEpisodeDirect(
    showId,
    episodeString,
    translationType,
  );

  return NextResponse.json(
    {
      sources: result.sources,
      ...(result.cached ? { cached: true } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
    {
      status: result.error && !result.sources ? 502 : 200,
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store, max-age=0",
      },
    },
  );
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
