"use client";

// components/anime/EpisodeGrid.tsx
// ✅ Premium section title with accent line
// ✅ Glass search input with focus glow
// ✅ Glass container for episode grid
// ✅ Episode tiles as pill buttons
// ✅ Pagination as pill buttons
// ✅ Jump-to-episode input
// ✅ SOON badge for unreleased episodes

import Link from "next/link";
import { useState, useMemo, useRef, useEffect } from "react";
import { Play, Search, Clock, Loader2, ChevronLeft, ChevronRight, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllAnimeInfo } from "@/hooks/useAllAnimeInfo";
import type { NextAiringEpisode } from "@/types/anime";

interface EpisodeGridProps {
  animeId: number;
  animeTitle: string;
  episodeCount: number | null;
  /** AniList's nextAiringEpisode — used to determine which episodes haven't aired yet. */
  nextAiringEpisode?: NextAiringEpisode | null;
}

const PAGE_SIZE = 100;

function getLatestAiredEpisode(next?: NextAiringEpisode | null): number {
  if (!next || typeof next.episode !== "number") return Infinity;
  return next.episode - 1;
}

function formatAiringTime(airingAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = airingAt - now;
  if (diff <= 0) return "Airing soon";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `Airs in ${days}d ${hours}h`;
  if (hours > 0) return `Airs in ${hours}h ${mins}m`;
  return `Airs in ${mins}m`;
}

export function EpisodeGrid({
  animeId,
  animeTitle,
  episodeCount,
  nextAiringEpisode,
}: EpisodeGridProps) {
  const [query, setQuery] = useState("");
  const [pageStart, setPageStart] = useState(1); // 1-indexed, inclusive
  const [jumpValue, setJumpValue] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  // ✅ Only fetch from AllAnime when AniList's episode count is unknown.
  const needsAllAnime = episodeCount == null && animeTitle.trim().length > 0;
  const { data: allAnimeData, isLoading: fetchingAllAnime } = useAllAnimeInfo(
    animeId,
    animeTitle,
    needsAllAnime,
  );
  const allAnimeCount = allAnimeData?.episodeCount ?? null;

  const isUnknown = episodeCount == null && allAnimeCount == null;
  const effectiveCount = episodeCount ?? allAnimeCount ?? 12;
  const usingAllAnimeFallback = episodeCount == null && allAnimeCount != null;

  const total = effectiveCount;
  const latestAired = getLatestAiredEpisode(nextAiringEpisode);
  const hasUpcoming = nextAiringEpisode != null;

  // Search mode: when query is set, search across ALL episodes (not just current page)
  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim();
    const matches: number[] = [];
    for (let n = 1; n <= total; n++) {
      if (String(n).includes(q)) matches.push(n);
    }
    return matches;
  }, [query, total]);

  // Paged mode: slice [pageStart, pageStart + PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor((pageStart - 1) / PAGE_SIZE) + 1;
  const pageEnd = Math.min(pageStart + PAGE_SIZE - 1, total);
  const pagedEpisodes = useMemo(() => {
    if (searchResults) return [];
    const arr: number[] = [];
    for (let n = pageStart; n <= pageEnd; n++) arr.push(n);
    return arr;
  }, [pageStart, pageEnd, searchResults]);

  const displayEpisodes = searchResults ?? pagedEpisodes;

  // ✅ Scroll grid to top when page changes or search is cleared.
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageStart, query]);

  const handleJump = () => {
    const n = parseInt(jumpValue, 10);
    if (!isNaN(n) && n >= 1 && n <= total) {
      // Jump to the page containing episode n
      const targetPageStart = Math.floor((n - 1) / PAGE_SIZE) * PAGE_SIZE + 1;
      setPageStart(targetPageStart);
      setQuery("");
      setJumpValue("");
    }
  };

  const goToPrevPage = () => {
    setPageStart((s) => Math.max(1, s - PAGE_SIZE));
  };
  const goToNextPage = () => {
    setPageStart((s) => Math.min(total - PAGE_SIZE + 1, s + PAGE_SIZE));
  };

  return (
    <section className="space-y-4">
      {/* ✅ Premium section title with accent line */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
        <h2 className="text-lg font-semibold font-display text-foreground">
          Episodes
        </h2>
        {!isUnknown && (
          <span className="text-xs text-muted-foreground ml-auto">
            {total} total
          </span>
        )}
      </div>

      {/* ✅ Glass search input with focus glow */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search episode number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-all focus:border-xan-crimson/40 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(233,69,96,0.12)]"
          />
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {searchResults
            ? `${searchResults.length} match${searchResults.length !== 1 ? "es" : ""}`
            : `Page ${currentPage} of ${totalPages}`}
        </span>
      </div>

      {/* Status messages */}
      {fetchingAllAnime && (
        <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking AllAnime for episode count…
        </p>
      )}
      {isUnknown && !fetchingAllAnime && (
        <p className="text-xs text-muted-foreground italic">
          Episode count unknown — showing first {PAGE_SIZE} by default.
        </p>
      )}
      {usingAllAnimeFallback && !fetchingAllAnime && (
        <p className="text-xs text-emerald-500/80 italic">
          Showing {total} episodes (via AllAnime cross-reference).
        </p>
      )}
      {!isUnknown && !usingAllAnimeFallback && episodeCount === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No episodes available for this anime yet.
        </p>
      )}
      {hasUpcoming && (
        <p className="text-xs text-muted-foreground/80 italic flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Episodes{" "}
          <span className="text-foreground/70 font-medium">
            {nextAiringEpisode!.episode}–{total}
          </span>{" "}
          haven&apos;t aired yet — shown in grayscale.
        </p>
      )}

      {/* ✅ Pagination as pill buttons (when needed) */}
      {searchResults ? (
        <p className="text-xs text-muted-foreground italic">
          {searchResults.length} match{searchResults.length !== 1 ? "es" : ""} for &ldquo;{query}&rdquo;
        </p>
      ) : total > PAGE_SIZE ? (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Episodes{" "}
            <span className="text-foreground/70 font-medium">
              {pageStart}–{pageEnd}
            </span>{" "}
            of {total}
          </p>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              className={cn(
                "h-8 px-3 text-xs rounded-full border transition-all flex items-center gap-1",
                currentPage === 1
                  ? "opacity-40 cursor-not-allowed border-white/8 text-muted-foreground"
                  : "border-white/8 bg-white/[0.04] text-foreground hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson",
              )}
            >
              <ChevronLeft className="h-3 w-3" />
              Prev
            </button>
            <span className="text-xs text-muted-foreground px-2 font-mono">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={cn(
                "h-8 px-3 text-xs rounded-full border transition-all flex items-center gap-1",
                currentPage === totalPages
                  ? "opacity-40 cursor-not-allowed border-white/8 text-muted-foreground"
                  : "border-white/8 bg-white/[0.04] text-foreground hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson",
              )}
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {/* ✅ Jump to episode input */}
          <div className="flex items-center gap-1 ml-1">
            <div className="relative">
              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input
                type="number"
                min={1}
                max={total}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJump()}
                placeholder="Jump…"
                className="w-20 h-8 pl-7 pr-2 text-xs rounded-full bg-white/[0.04] border border-white/8 text-foreground outline-none focus:border-xan-crimson/40 focus:bg-white/[0.07]"
              />
            </div>
            <button
              onClick={handleJump}
              disabled={!jumpValue}
              className={cn(
                "h-8 px-3 text-xs rounded-full border transition-all",
                !jumpValue
                  ? "opacity-40 cursor-not-allowed border-white/8 text-muted-foreground"
                  : "border-xan-crimson/30 bg-xan-crimson/10 text-xan-crimson hover:bg-xan-crimson/20",
              )}
            >
              Go
            </button>
          </div>
        </div>
      ) : null}

      {/* ✅ Glass container for episode grid */}
      <div
        ref={gridRef}
        className="h-80 overflow-y-auto rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm xan-scroll"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3">
          {displayEpisodes.length > 0 ? (
            displayEpisodes.map((n) => {
              const isReleased = n <= latestAired;
              const isNext = hasUpcoming && n === nextAiringEpisode!.episode;
              const airingHint =
                isNext && nextAiringEpisode
                  ? formatAiringTime(nextAiringEpisode.airingAt)
                  : isReleased
                    ? undefined
                    : "Not yet aired";

              if (!isReleased) {
                return (
                  <div
                    key={n}
                    title={airingHint}
                    className={cn(
                      "flex items-center justify-between h-9 px-3 rounded-full text-xs border select-none cursor-not-allowed",
                      isNext
                        ? "bg-xan-crimson/10 border-xan-crimson/40 text-xan-crimson"
                        : "bg-white/[0.02] border-white/8 text-muted-foreground opacity-60",
                    )}
                  >
                    <span className="flex items-center gap-1.5 line-through decoration-muted-foreground/40">
                      <Clock className="h-3 w-3" />
                      Ep {n}
                    </span>
                    {isNext && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/40 font-mono font-bold tracking-wider">
                        SOON
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={n}
                  href={`/watch/${animeId}?ep=${n}`}
                  className="group flex items-center justify-between h-9 px-3 rounded-full text-xs border border-white/8 bg-white/[0.04] text-foreground transition-all hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson hover:shadow-[0_2px_12px_rgba(233,69,96,0.18)]"
                >
                  <span className="flex items-center gap-1.5">
                    <Play className="h-3 w-3 text-xan-crimson fill-xan-crimson" />
                    Ep {n}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase tracking-wider">
                    Play
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="col-span-full text-sm text-muted-foreground text-center py-6">
              {query ? `No episodes matching "${query}".` : "No episodes found."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
