// lib/allanime.ts
// ✅ AllAnime GraphQL client — the public GraphQL API at api.allanime.day
// No API key required. Works publicly.
//
// Provides:
//   - Search by title → returns AllAnime ID + AniList ID mapping
//   - Full anime info (score, description, episode count, available episodes)
//   - Direct lookup by AniList ID (using the `aniListId` field on every show)
//
// NOTE: Stream URLs themselves are Cloudflare-protected (need browser JS to solve).
// We expose `fetchAllAnimeStreamSources()` as a best-effort attempt that will
// typically return null — the stream proxy falls back to mock HLS in that case.

import { z } from "zod";

const ALLANIME_GRAPHQL = "https://api.allanime.day/api/graphql";
const REQUEST_TIMEOUT_MS = 12000;

// ─── Schemas ───
export const AllAnimeShowSchema = z.object({
  _id: z.string(),
  name: z.string(),
  englishName: z.string().nullable().default(null),
  nativeName: z.string().nullable().default(null),
  aniListId: z.string().nullable().default(null),
  malId: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  thumbnail: z.string().nullable().default(null),
  banner: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  type: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
  season: z.unknown().nullable().default(null),
  airedStart: z.unknown().nullable().default(null),
  genres: z.array(z.string()).default([]),
  studios: z.array(z.string()).default([]),
  episodeCount: z.string().nullable().default(null),
  episodeDuration: z.string().nullable().default(null),
  availableEpisodes: z
    .object({
      sub: z.number().default(0),
      dub: z.number().default(0),
      raw: z.number().default(0),
    })
    .nullable()
    .default(null),
  availableEpisodesDetail: z
    .object({
      sub: z.array(z.string()).default([]),
      dub: z.array(z.string()).default([]),
      raw: z.array(z.string()).default([]),
    })
    .nullable()
    .default(null),
  countryOfOrigin: z.string().nullable().default(null),
});
export type AllAnimeShow = z.infer<typeof AllAnimeShowSchema>;

const ShowsResponseSchema = z.object({
  data: z.object({
    shows: z.object({
      edges: z.array(AllAnimeShowSchema).default([]),
    }),
  }),
});

const ShowResponseSchema = z.object({
  data: z.object({
    show: AllAnimeShowSchema.nullable(),
  }),
});

// ─── Internal fetch ───
async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ALLANIME_GRAPHQL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131",
        Referer: "https://allmanga.to/",
        Origin: "https://allmanga.to",
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`[AllAnime] HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json?.errors) {
      console.error("[AllAnime] GraphQL errors:", json.errors[0]?.message);
      return null;
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      console.error("[AllAnime] invalid response:", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[AllAnime] timed out");
    } else {
      console.error("[AllAnime] fetch failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API ───

export interface AllAnimeSearchResult {
  edges: AllAnimeShow[];
}

export async function searchAllAnime(
  query: string,
  limit = 10,
): Promise<AllAnimeSearchResult | null> {
  if (!query.trim()) return null;
  const result = await gql(
    `query($s:SearchInput,$limit:Int){shows(search:$s,limit:$limit){edges{_id name englishName aniListId malId thumbnail score type episodeCount availableEpisodes}}}`,
    { s: { query }, limit },
    ShowsResponseSchema,
  );
  if (!result) return null;
  return { edges: result.data.shows.edges };
}

export async function fetchAllAnimeById(
  allAnimeId: string,
): Promise<AllAnimeShow | null> {
  const result = await gql(
    `query($id:String!){show(_id:$id){_id name englishName nativeName aniListId malId description thumbnail banner score type status season airedStart genres studios episodeCount episodeDuration availableEpisodes availableEpisodesDetail countryOfOrigin}}`,
    { id: allAnimeId },
    ShowResponseSchema,
  );
  return result?.data.show ?? null;
}

/**
 * Find AllAnime show by AniList ID. AllAnime stores `aniListId` on every show,
 * but there's no direct lookup — we have to use `showsWithIds` or search by the
 * AniList anime's English title.
 */
export async function findShowByAniListId(
  anilistId: number,
  anilistTitle: string,
): Promise<AllAnimeShow | null> {
  // First try searching by title — AllAnime search is fuzzy enough that this
  // almost always finds the right show. Then we filter by aniListId match.
  const search = await searchAllAnime(anilistTitle, 10);
  if (!search) return null;

  const exact = search.edges.find((s) => s.aniListId === String(anilistId));
  if (exact) return exact;

  // Fallback: fetch full details for the top 3 search results and look for an aniListId match
  for (const candidate of search.edges.slice(0, 3)) {
    const full = await fetchAllAnimeById(candidate._id);
    if (full?.aniListId === String(anilistId)) return full;
  }

  // Final fallback: return first search result
  return search.edges[0] ?? null;
}

/**
 * Best-effort attempt to fetch stream sources for an episode.
 *
 * NOTE: AllAnime's stream URL endpoint (`/episodes?id=<showId>&episode=<ep>`)
 * is Cloudflare-protected and requires real browser JS to solve the challenge.
 * Server-side fetch will almost always fail with HTTP 403. Returns null in
 * that case so the caller can fall back to mock HLS.
 */
export async function fetchAllAnimeStreamSources(
  allAnimeId: string,
  episode: string,
  type: "sub" | "dub" = "sub",
): Promise<{ url: string; quality: string | null }[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `https://api.allanime.day/episodes?id=${encodeURIComponent(allAnimeId)}&episode=${encodeURIComponent(episode)}&type=${type}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://allmanga.to/",
        Origin: "https://allmanga.to",
      },
    });

    if (!res.ok) {
      console.warn(`[AllAnime] stream endpoint HTTP ${res.status} (likely Cloudflare challenge)`);
      return null;
    }

    const json = await res.json();
    const sources = z
      .array(
        z.object({
          url: z.string(),
          quality: z.string().nullable().default(null),
        }),
      )
      .safeParse(json?.sources ?? []);

    return sources.success ? sources.data : null;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[AllAnime] stream fetch timed out");
    } else {
      console.error("[AllAnime] stream fetch failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Helpers ───

export function getAllAnimeTitle(show: AllAnimeShow): string {
  return show.englishName ?? show.name ?? show.nativeName ?? "Untitled";
}

export function getAllAnimeCover(show: AllAnimeShow): string {
  return show.thumbnail ?? "/placeholder-card.png";
}

export function formatAllAnimeScore(score: number | null): string {
  if (score == null) return "N/A";
  return score.toFixed(2);
}
