// app/(app)/home/page.tsx
// Server Component (async) — fetches AniList, wraps sections in Suspense + ErrorBoundary

import { Suspense } from "react";
import { fetchTrending, fetchPopular, fetchAiringSchedule } from "@/lib/anilist";
import { HomeHero } from "@/components/home/HomeHero";
import { TopTenRow } from "@/components/home/TopTenRow";
import { TrendingRow } from "@/components/home/TrendingRow";
import { AiringTodayRow } from "@/components/home/AiringTodayRow";
import { PopularGrid } from "@/components/home/PopularGrid";
import { ContinueWatchingSmall } from "@/components/home/ContinueWatchingSmall";
import { BookmarksRow } from "@/components/home/BookmarksRow";
import { RecommendationsRow } from "@/components/home/RecommendationsRow";
import { AnimeCardSkeleton } from "@/components/cards/AnimeCardSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { AiringSchedule } from "@/types/anime";

export const revalidate = 300; // ISR — refresh every 5 minutes

function TrendingHeroSkeleton() {
  return (
    <section className="relative w-full h-[78vh] min-h-[520px] max-h-[760px] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-xan-card via-xan-dark to-xan-dark animate-shimmer" />
      <div className="relative h-full max-w-7xl mx-auto px-4 md:px-6 flex items-center pb-16 md:pb-20">
        <div className="space-y-4 w-full max-w-2xl">
          <div className="h-4 w-32 bg-white/10 rounded animate-shimmer" />
          <div className="h-16 w-3/4 bg-white/10 rounded animate-shimmer" />
          <div className="h-4 w-1/2 bg-white/5 rounded animate-shimmer" />
          <div className="flex gap-3 pt-2">
            <div className="h-12 w-36 bg-white/10 rounded-full animate-shimmer" />
            <div className="h-12 w-32 bg-white/5 rounded-full animate-shimmer" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TopTenSkeleton() {
  return (
    <section className="space-y-4">
      <div className="h-8 w-48 bg-xan-card rounded animate-shimmer" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[260px] h-[220px] bg-xan-card rounded-xl animate-shimmer"
          />
        ))}
      </div>
    </section>
  );
}

function RowSkeleton({ width = 48 }: { width?: number }) {
  // Generic horizontal-scroller skeleton used by Airing Today + Trending Now.
  return (
    <section className="space-y-4">
      <div className="h-8 bg-xan-card rounded animate-shimmer" style={{ width: `${width * 4}px` }} />
      <div className="flex gap-2 sm:gap-3 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-xl bg-xan-card animate-shimmer"
            style={{ width: "clamp(120px, 32vw, 170px)", aspectRatio: "2 / 3" }}
          />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="relative -mt-16">
      {/* Cinematic hero (server-fetched, client-rendered) */}
      <ErrorBoundary message="Couldn't load hero">
        <Suspense fallback={<TrendingHeroSkeleton />}>
          <HeroSection />
        </Suspense>
      </ErrorBoundary>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-10 md:space-y-14">
        {/* Airing Today — new episodes dropping today */}
        <ErrorBoundary message="Couldn't load airing today">
          <Suspense fallback={<RowSkeleton width={36} />}>
            <AiringTodaySection />
          </Suspense>
        </ErrorBoundary>

        {/* Trending Now — the hottest anime right now */}
        <ErrorBoundary message="Couldn't load trending">
          <Suspense fallback={<RowSkeleton width={40} />}>
            <TrendingSection />
          </Suspense>
        </ErrorBoundary>

        {/* Continue Watching (compact, one card per anime) */}
        <ContinueWatchingSmall />

        {/* Bookmarks (saved for later) */}
        <BookmarksRow />

        {/* Top 10 Today — Netflix-style ranked row */}
        <ErrorBoundary message="Couldn't load Top 10">
          <Suspense fallback={<TopTenSkeleton />}>
            <TopTenSection />
          </Suspense>
        </ErrorBoundary>

        {/* Recommended For You — below Top 10 */}
        <ErrorBoundary message="Couldn't load recommendations">
          <RecommendationsRow />
        </ErrorBoundary>

        {/* Popular */}
        <ErrorBoundary message="Couldn't load popular">
          <Suspense
            fallback={
              <section className="space-y-4">
                <div className="h-8 w-40 bg-xan-card rounded animate-shimmer" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 15 }, (_, i) => (
                    <AnimeCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            }
          >
            <PopularSection />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

// ─── Async Server Components — can use await directly ───

async function HeroSection() {
  const result = await fetchTrending(1, 10);
  if (!result || result.data.length === 0) {
    return (
      <section className="relative w-full h-[60vh] min-h-[400px] bg-xan-dark" />
    );
  }
  return <HomeHero anime={result.data} />;
}

/**
 * Airing Today — fetches today's airing schedule (local day, 00:00 → +24h) and
 * deduplicates by anime id so each anime appears at most once. The episode
 * shown is the FIRST one airing today for that anime (sorted by airingAt asc).
 * If AniList returns nothing for today (rare — e.g. timezone edge cases or
 * downtime), the section is hidden by returning null and the row's own empty
 * guard handles the empty state.
 */
async function AiringTodaySection() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const start = Math.floor(startOfDay.getTime() / 1000);
  const end = Math.floor(endOfDay.getTime() / 1000);

  // Fetch up to 2 pages (100 episodes) — that's plenty for a single day.
  // Anime airs ~30-50 new episodes per day across all simulcasts, so one
  // page (50) usually suffices; a second page is a safety net for busy days.
  const [page1, page2] = await Promise.all([
    fetchAiringSchedule(start, end, 1, 50).catch(() => null),
    fetchAiringSchedule(start, end, 2, 50).catch(() => null),
  ]);

  const all: AiringSchedule[] = [
    ...(page1?.data ?? []),
    ...(page2?.data ?? []),
  ];
  if (all.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No new episodes airing today.
      </p>
    );
  }

  // Dedupe by anime id, keeping the earliest airing episode per anime.
  const seen = new Map<number, AiringSchedule>();
  for (const s of all) {
    if (!s.media) continue;
    const id = s.media.id;
    if (!seen.has(id)) seen.set(id, s);
  }
  const deduped = Array.from(seen.values()).sort(
    (a, b) => a.airingAt - b.airingAt,
  );

  return <AiringTodayRow schedules={deduped} />;
}

/**
 * Trending Now — shows up to 15 currently trending anime. Uses the same
 * AniList TRENDING_DESC sort as the hero, but paginates past the first 10
 * so the row has more depth than the hero's 10-item carousel.
 */
async function TrendingSection() {
  const result = await fetchTrending(1, 15);
  if (!result || result.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No trending anime found.</p>
    );
  }
  return <TrendingRow anime={result.data} />;
}

async function TopTenSection() {
  const result = await fetchTrending(1, 10);
  if (!result || result.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No trending anime found.</p>
    );
  }
  return <TopTenRow anime={result.data} />;
}

async function PopularSection() {
  const result = await fetchPopular(1, 15);
  if (!result || result.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No popular anime found.</p>
    );
  }
  return <PopularGrid anime={result.data} pageInfo={result.pageInfo} />;
}
