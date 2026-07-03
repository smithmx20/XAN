// app/(app)/home/page.tsx
// Server Component (async) — fetches AniList, wraps sections in Suspense + ErrorBoundary

import { Suspense } from "react";
import { fetchTrending, fetchPopular } from "@/lib/anilist";
import { HomeHero } from "@/components/home/HomeHero";
import { GenrePills } from "@/components/home/GenrePills";
import { TopTenRow } from "@/components/home/TopTenRow";
import { PopularGrid } from "@/components/home/PopularGrid";
import { ContinueWatchingSmall } from "@/components/home/ContinueWatchingSmall";
import { RecommendationsRow } from "@/components/home/RecommendationsRow";
import { AnimeCardSkeleton } from "@/components/cards/AnimeCardSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
        {/* Quick genre shortcuts */}
        <GenrePills />

        {/* Continue Watching (compact, one card per anime) */}
        <ContinueWatchingSmall />

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
