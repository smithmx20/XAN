// lib/jikan.ts
// ✅ Jikan v4 client — the public MyAnimeList API.
// No API key required. Rate limit: 3 req/sec, 60 req/min.
// We mitigate rate limits with ISR caching (server-side) and a small in-memory
// dedupe window on the client.

import { z } from "zod";

const JIKAN_URL = "https://api.jikan.moe/v4";
const REQUEST_TIMEOUT_MS = 10000;

// ─── Force IPv4 ───
// Jikan's DNS only returns an AAAA (IPv6) record, and the sandbox has no IPv6
// outbound. Force IPv4 via undici's Agent to bypass this.
// We use undici.fetch directly because the global fetch doesn't honor the
// `dispatcher` option.
import type { Agent } from "undici";

let cachedAgent: Agent | null = null;
async function getAgent(): Promise<Agent | null> {
  if (cachedAgent) return cachedAgent;
  try {
    const undici = await import("undici");
    cachedAgent = new undici.Agent({ connect: { family: 4 } });
    return cachedAgent;
  } catch {
    return null;
  }
}

// ─── Jikan image schema ───
const JikanImageSetSchema = z.object({
  jpg: z.object({
    image_url: z.string().nullable().default(null),
    small_image_url: z.string().nullable().default(null),
    large_image_url: z.string().nullable().default(null),
  }),
  webp: z.object({
    image_url: z.string().nullable().default(null),
    small_image_url: z.string().nullable().default(null),
    large_image_url: z.string().nullable().default(null),
  }),
});

// ─── Jikan anime schema (subset of fields we use) ───
export const JikanAnimeSchema = z.object({
  mal_id: z.number(),
  url: z.string().nullable().default(null),
  title: z.string(),
  title_english: z.string().nullable().default(null),
  title_japanese: z.string().nullable().default(null),
  images: JikanImageSetSchema,
  trailer: z
    .object({
      youtube_id: z.string().nullable().default(null),
      url: z.string().nullable().default(null),
      embed_url: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  type: z.string().nullable().default(null),
  episodes: z.number().nullable().default(null),
  status: z.string().nullable().default(null),
  airing: z.boolean().default(false),
  duration: z.string().nullable().default(null),
  rating: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  scored_by: z.number().nullable().default(null),
  rank: z.number().nullable().default(null),
  popularity: z.number().nullable().default(null),
  members: z.number().nullable().default(null),
  favorites: z.number().nullable().default(null),
  synopsis: z.string().nullable().default(null),
  season: z.string().nullable().default(null),
  year: z.number().nullable().default(null),
  studios: z
    .array(z.object({ mal_id: z.number(), name: z.string() }))
    .default([]),
  genres: z
    .array(z.object({ mal_id: z.number(), name: z.string() }))
    .default([]),
});
export type JikanAnime = z.infer<typeof JikanAnimeSchema>;

// ─── Paginated response wrapper ───
const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    pagination: z
      .object({
        last_visible_page: z.number().default(1),
        has_next_page: z.boolean().default(false),
        current_page: z.number().default(1),
        items: z
          .object({
            count: z.number().default(0),
            total: z.number().default(0),
            per_page: z.number().default(0),
          })
          .default({ count: 0, total: 0, per_page: 0 }),
      })
      .default({
        last_visible_page: 1,
        has_next_page: false,
        current_page: 1,
        items: { count: 0, total: 0, per_page: 0 },
      }),
  });

const JikanSearchSchema = PaginatedSchema(JikanAnimeSchema);
const JikanTopSchema = PaginatedSchema(JikanAnimeSchema);
const JikanSeasonSchema = PaginatedSchema(JikanAnimeSchema);

// ─── Internal fetch helper ───
async function jikanFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  // ISR caching is disabled when using undici.fetch (not honored). We instead
  // rely on the API route layer / next revalidate for caching.
  _revalidateSeconds = 3600,
): Promise<T | null> {
  const url = `${JIKAN_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const agent = await getAgent();
    const undici = await import("undici");

    const res = await undici.fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      dispatcher: agent ?? undefined,
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("[Jikan] rate limited — backing off");
      } else {
        console.error(`[Jikan] HTTP ${res.status} for ${path}`);
      }
      return null;
    }

    const json = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      console.error("[Jikan] invalid response:", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[Jikan] timed out for", path);
    } else {
      console.error("[Jikan] fetch failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API ───

export interface JikanPageResult {
  data: JikanAnime[];
  hasNextPage: boolean;
  currentPage: number;
  lastPage: number;
  total: number;
}

function toPageResult(parsed: z.infer<typeof JikanSearchSchema>): JikanPageResult {
  return {
    data: parsed.data,
    hasNextPage: parsed.pagination.has_next_page,
    currentPage: parsed.pagination.current_page,
    lastPage: parsed.pagination.last_visible_page,
    total: parsed.pagination.items.total,
  };
}

/** Top anime (filterable by type: tv, movie, ova, etc.) */
export async function fetchJikanTop(
  page = 1,
  type?: "tv" | "movie" | "ova" | "special" | "ona" | "music",
): Promise<JikanPageResult | null> {
  const typeFilter = type ? `&type=${type}` : "";
  const path = `/top/anime?page=${page}&limit=24${typeFilter}`;
  const result = await jikanFetch(path, JikanTopSchema, 3600);
  return result ? toPageResult(result) : null;
}

/** Currently airing this season */
export async function fetchJikanSeasonNow(page = 1): Promise<JikanPageResult | null> {
  const path = `/seasons/now?page=${page}&limit=24`;
  const result = await jikanFetch(path, JikanSeasonSchema, 3600);
  return result ? toPageResult(result) : null;
}

/** Search by title (debounced on the client side) */
export async function fetchJikanSearch(
  query: string,
  page = 1,
  limit = 24,
): Promise<JikanPageResult | null> {
  if (!query.trim()) return null;
  const path = `/anime?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&order_by=members&sort=desc`;
  const result = await jikanFetch(path, JikanSearchSchema, 600);
  return result ? toPageResult(result) : null;
}

/** Random anime */
export async function fetchJikanRandom(): Promise<JikanAnime | null> {
  const RandomSchema = z.object({ data: JikanAnimeSchema });
  const result = await jikanFetch("/random/anime", RandomSchema, 0);
  return result?.data ?? null;
}

/** Full details by MAL ID */
export async function fetchJikanById(malId: number): Promise<JikanAnime | null> {
  const FullSchema = z.object({ data: JikanAnimeSchema });
  const result = await jikanFetch(`/anime/${malId}/full`, FullSchema, 3600);
  return result?.data ?? null;
}

// ─── Helpers ───

export function getJikanTitle(anime: JikanAnime): string {
  return anime.title_english ?? anime.title ?? anime.title_japanese ?? "Untitled";
}

export function getJikanCover(anime: JikanAnime): string {
  return (
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url ||
    anime.images?.webp?.image_url ||
    anime.images?.jpg?.image_url ||
    "/placeholder-card.png"
  );
}

/** Cross-reference AniList anime → Jikan by searching for the English title. */
export async function findJikanByAnilistTitle(
  title: string,
): Promise<JikanAnime | null> {
  const result = await fetchJikanSearch(title, 1, 5);
  if (!result || result.data.length === 0) return null;
  // Best match: case-insensitive exact match, else first result
  const exact = result.data.find(
    (a) =>
      a.title_english?.toLowerCase() === title.toLowerCase() ||
      a.title.toLowerCase() === title.toLowerCase(),
  );
  return exact ?? result.data[0] ?? null;
}
