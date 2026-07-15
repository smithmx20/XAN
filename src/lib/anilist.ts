// lib/anilist.ts
// ✅ Defensive API client — bounded retry + AbortController + per-item Zod validation
// ✅ React `cache()` wrapper dedupes identical calls within a single server render
//    pass (e.g. home page calls fetchTrending(1,10) twice — hero + top10 — now hits
//    AniList only once).

import { cache } from "react";
import {
  AnimeSchema,
  PageInfoSchema,
  AnimeDetailSchema,
  AiringScheduleSchema,
  CharacterDetailSchema,
  type Anime,
  type AnimeDetail,
  type AiringSchedule,
  type PageInfo,
  type CharacterDetail,
} from "@/types/anime";
import {
  TRENDING_QUERY,
  POPULAR_QUERY,
  SEARCH_QUERY,
  ANIME_DETAIL_QUERY,
  AIRING_SCHEDULE_QUERY,
  CHARACTER_QUERY,
} from "./anilist-queries";
import { isTag } from "./constants";
import { z } from "zod";

const ANILIST_URL = "https://graphql.anilist.co";
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 10000;

interface FetchResult {
  data: Anime[];
  pageInfo: PageInfo;
}

interface FetchDetailResult {
  data: AnimeDetail | null;
}

async function fetchFromAniList(
  query: string,
  variables: Record<string, unknown>,
  _retryCount = 0,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      // ✅ Retry on 429 (rate limit) AND 500/502/503/504 (server errors)
      const shouldRetry =
        (response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504) &&
        _retryCount < MAX_RETRIES;

      if (shouldRetry) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_DELAY_MS * (_retryCount + 1);
        await new Promise((r) => setTimeout(r, delay));
        return fetchFromAniList(query, variables, _retryCount + 1);
      }
      // ✅ 404 is expected for non-existent anime IDs — don't log as error
      if (response.status === 404) {
        console.warn(`[AniList] 404: Resource not found (this is expected for invalid IDs)`);
      } else {
        console.error(`[AniList] HTTP ${response.status}: ${response.statusText}`);
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("[AniList] Request timed out after", REQUEST_TIMEOUT_MS, "ms");
    } else {
      console.error("[AniList] Fetch failed:", error);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchList(
  query: string,
  variables: Record<string, unknown>,
): Promise<FetchResult | null> {
  const json = await fetchFromAniList(query, variables);
  if (!json) return null;

  const media = (json as any)?.data?.Page?.media;
  const pageInfoRaw = (json as any)?.data?.Page?.pageInfo;

  if (!Array.isArray(media)) {
    console.error("[AniList] Unexpected response shape — media is not an array");
    return null;
  }

  const validated = media
    .map((item: unknown) => AnimeSchema.safeParse(item))
    .filter((r): r is z.ZodSafeParseSuccess<Anime> => r.success)
    .map((r) => r.data);

  const pageInfo = PageInfoSchema.safeParse(pageInfoRaw);

  return {
    data: validated,
    pageInfo: pageInfo.success
      ? pageInfo.data
      : {
          currentPage: 1,
          hasNextPage: false,
          lastPage: null,
          perPage: 20,
          total: null,
        },
  };
}

export const fetchTrending = cache(
  async (page = 1, perPage = 20): Promise<FetchResult | null> => {
    return fetchList(TRENDING_QUERY, { page, perPage });
  },
);

export const fetchPopular = cache(
  async (page = 1, perPage = 20): Promise<FetchResult | null> => {
    return fetchList(POPULAR_QUERY, { page, perPage });
  },
);

export const fetchSearch = cache(
  async (
    search: string,
    page = 1,
    perPage = 20,
    genres?: string[],
    sort?: string,
    tags?: string[],
    format?: string,
  ): Promise<FetchResult | null> => {
    return fetchList(SEARCH_QUERY, {
      search: search || null,
      page,
      perPage,
      genres: genres && genres.length > 0 ? genres : undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
      sort: sort ? [sort] : undefined,
      format: format || undefined,
    });
  },
);

export const fetchAnimeDetail = cache(
  async (id: number): Promise<FetchDetailResult | null> => {
    const json = await fetchFromAniList(ANIME_DETAIL_QUERY, { id });
    if (!json) return null;

    const raw = (json as any)?.data?.Media;
    if (!raw) {
      console.error("[AniList] Detail response missing Media field");
      return { data: null };
    }

    const parsed = AnimeDetailSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[AniList] Detail validation failed:", parsed.error.issues);
      return { data: null };
    }

    return { data: parsed.data };
  },
);

export const fetchByGenre = cache(
  async (
    genre: string,
    page = 1,
    perPage = 20,
  ): Promise<FetchResult | null> => {
    if (isTag(genre)) {
      return fetchList(SEARCH_QUERY, {
        search: null,
        page,
        perPage,
        tags: [genre],
      });
    }
    return fetchList(SEARCH_QUERY, {
      search: null,
      page,
      perPage,
      genres: [genre],
    });
  },
);

export interface AiringScheduleResult {
  data: AiringSchedule[];
  pageInfo: PageInfo;
}

export const fetchAiringSchedule = cache(
  async (
    startTime: number,
    endTime: number,
    page = 1,
    perPage = 50,
  ): Promise<AiringScheduleResult | null> => {
  const json = await fetchFromAniList(AIRING_SCHEDULE_QUERY, {
    page,
    perPage,
    airingAtGreater: startTime,
    airingAtLesser: endTime,
  });
  if (!json) return null;

  const schedulesRaw = (json as any)?.data?.Page?.airingSchedules;
  const pageInfoRaw = (json as any)?.data?.Page?.pageInfo;
  if (!Array.isArray(schedulesRaw)) {
    console.error("[AniList] AiringSchedule: response shape unexpected");
    return null;
  }

  const validated = schedulesRaw
    .map((item: unknown) => AiringScheduleSchema.safeParse(item))
    .filter((r): r is z.ZodSafeParseSuccess<AiringSchedule> => r.success)
    .map((r) => r.data);

  const pageInfo = PageInfoSchema.safeParse(pageInfoRaw);

  return {
    data: validated,
    pageInfo: pageInfo.success
      ? pageInfo.data
      : {
          currentPage: 1,
          hasNextPage: false,
          lastPage: null,
          perPage: 50,
          total: null,
        },
  };
});

// ✅ Character Detail — fetches a single character + their anime appearances.
//    Cached per-request via React `cache()` so generateMetadata and the page
//    body don't double-fetch.
export const fetchCharacter = cache(
  async (id: number): Promise<{ data: CharacterDetail | null } | null> => {
    const json = await fetchFromAniList(CHARACTER_QUERY, { id });
    if (!json) return null;

    const raw = (json as any)?.data?.Character;
    if (!raw) {
      console.warn("[AniList] Character response missing Character field");
      return { data: null };
    }

    const parsed = CharacterDetailSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        "[AniList] Character validation failed:",
        parsed.error.issues,
      );
      return { data: null };
    }

    return { data: parsed.data };
  },
);
