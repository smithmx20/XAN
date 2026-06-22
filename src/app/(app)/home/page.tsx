// app/(app)/home/page.tsx
// Server Component (async) — fetches from BOTH AniList (trending/popular/genre)
// and Jikan/MyAnimeList (top-rated, this season, random).

import { Suspense } from "react";
import { fetchTrending, fetchPopular } from "@/lib/anilist";
import { TrendingCarousel } from "@/components/home/TrendingCarousel";
import { PopularGrid } from "@/components/home/PopularGrid";
import { ContinueWatching } from "@/components/home/ContinueWatching";
import { CategoryTabs } from "@/components/home/CategoryTabs";
import { TopMalCarousel } from "@/components/home/TopMalCarousel";
import { ThisSeasonGrid } from "@/components/home/ThisSeasonGrid";
import { RandomAnimeButton } from "@/components/jikan/RandomAnimeButton";
import { AnimeCardSkeleton } from "@/components/cards/AnimeCardSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const revalidate = 300;

function CarouselSkeleton() {
  return (
    <section className="space-y-4">
      <div className="h-8 w-40 bg-xan-card rounded animate-shimmer" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[150px] sm:w-[160px] md:w-[180px]"
          >
            <AnimeCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

function GridSkeleton() {
  return (
    <section className="space-y-4">
      <div className="h-8 w-40 bg-xan-card rounded animate-shimmer" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 15 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12">
      {/* Header with random button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Discover Anime
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Powered by AniList + MyAnimeList (Jikan)
          </p>
        </div>
        <RandomAnimeButton />
      </div>

      {/* Continue Watching (client — localStorage) */}
      <ContinueWatching />

      {/* AniList — Trending */}
      <ErrorBoundary message="Couldn't load trending">
        <Suspense fallback={<CarouselSkeleton />}>
          <TrendingSection />
        </Suspense>
      </ErrorBoundary>

      {/* Jikan — Top on MyAnimeList */}
      <ErrorBoundary message="Couldn't load Top MAL">
        <Suspense fallback={<CarouselSkeleton />}>
          <TopMalCarousel />
        </Suspense>
      </ErrorBoundary>

      {/* AniList — Popular */}
      <ErrorBoundary message="Couldn't load popular">
        <Suspense fallback={<GridSkeleton />}>
          <PopularSection />
        </Suspense>
      </ErrorBoundary>

      {/* Jikan — This Season */}
      <ErrorBoundary message="Couldn't load This Season">
        <Suspense fallback={<CarouselSkeleton />}>
          <ThisSeasonGrid />
        </Suspense>
      </ErrorBoundary>

      {/* AniList — By Genre */}
      <CategoryTabs />
    </div>
  );
}

// ─── Async Server Components — can use await directly ───
async function TrendingSection() {
  const result = await fetchTrending(1, 15);
  if (!result || result.data.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        No trending anime found.
      </p>
    );
  return <TrendingCarousel anime={result.data} />;
}

async function PopularSection() {
  const result = await fetchPopular(1, 15);
  if (!result || result.data.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        No popular anime found.
      </p>
    );
  return <PopularGrid anime={result.data} pageInfo={result.pageInfo} />;
}
