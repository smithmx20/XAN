"use client";

// app/(app)/history/page.tsx
// ✅ "use client" — reads localStorage
// Groups all watched episodes of the same anime into one card with episode chips

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import {
  History as HistoryIcon,
  Trash2,
  Play,
  Clock,
  Film,
} from "lucide-react";
import { useWatchHistory, type WatchHistoryEntry } from "@/hooks/useWatchHistory";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface GroupedHistoryEntry {
  animeId: number;
  title: string;
  coverImage: string;
  episodes: WatchHistoryEntry[]; // sorted most-recent-first
  latest: WatchHistoryEntry;
}

function groupByAnime(history: WatchHistoryEntry[]): GroupedHistoryEntry[] {
  const map = new Map<number, GroupedHistoryEntry>();
  for (const entry of history) {
    const existing = map.get(entry.animeId);
    if (existing) {
      existing.episodes.push(entry);
      if (entry.updatedAt > existing.latest.updatedAt) {
        existing.latest = entry;
      }
    } else {
      map.set(entry.animeId, {
        animeId: entry.animeId,
        title: entry.title,
        coverImage: entry.coverImage,
        episodes: [entry],
        latest: entry,
      });
    }
  }
  // Sort groups by latest updatedAt
  return Array.from(map.values()).sort(
    (a, b) => b.latest.updatedAt - a.latest.updatedAt,
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatProgress(timestamp: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (timestamp / duration) * 100));
}

export default function HistoryPage() {
  const { history, isLoaded, removeEntry, clearHistory } = useWatchHistory();

  const grouped = isLoaded ? groupByAnime(history) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-xan-crimson" />
            Watch History
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoaded && grouped.length > 0
              ? `${grouped.length} anime • ${history.length} episodes watched`
              : "Your recently watched anime. Stored locally in your browser."}
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="secondary"
            onClick={clearHistory}
            className="bg-xan-card border-xan-border hover:bg-xan-card-hover text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear All
          </Button>
        )}
      </div>

      {/* Loading skeleton */}
      {!isLoaded ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full bg-xan-card rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-xan-border bg-xan-card/50 py-16 text-center">
          <HistoryIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            No history yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Start watching anime to build your history. Your progress will be
            saved here for quick access.
          </p>
          <Button asChild className="bg-gradient-to-r from-xan-crimson to-xan-violet hover:opacity-90 text-white border-0">
            <Link href="/home">Browse Anime</Link>
          </Button>
        </div>
      ) : (
        /* Grouped-by-anime list */
        <div className="space-y-3">
          {grouped.map((entry, idx) => {
            const progress = formatProgress(
              entry.latest.timestamp,
              entry.latest.duration,
            );
            // Sort episodes by number for display
            const sortedEps = [...entry.episodes].sort(
              (a, b) => a.episodeNumber - b.episodeNumber,
            );

            return (
              <motion.div
                key={entry.animeId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                className="group relative"
              >
                <div className="flex flex-col md:flex-row items-stretch gap-3 p-3 rounded-xl border border-xan-border bg-xan-card hover:bg-xan-card-hover hover:border-xan-crimson/30 transition-all">
                  {/* Cover + play overlay */}
                  <Link
                    href={`/watch/${entry.animeId}?ep=${entry.latest.episodeNumber}`}
                    className="relative w-full md:w-32 aspect-video md:aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 bg-xan-card-hover group/cover"
                  >
                    <Image
                      src={entry.coverImage || "/placeholder-card.png"}
                      alt={entry.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 128px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-xan-crimson/95 flex items-center justify-center">
                        <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div
                        className="h-full bg-xan-crimson"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {/* Episode count badge */}
                    {entry.episodes.length > 1 && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-black/75 backdrop-blur-sm text-white flex items-center gap-1">
                        <Film className="h-2.5 w-2.5" />
                        {entry.episodes.length}
                      </div>
                    )}
                  </Link>

                  {/* Info + episodes */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/anime/${entry.animeId}`}
                          className="text-sm md:text-base font-semibold text-foreground line-clamp-1 hover:text-xan-crimson transition-colors"
                        >
                          {entry.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <Clock className="h-3 w-3" />
                          Last watched EP {entry.latest.episodeNumber}
                          <span className="text-muted-foreground/60">•</span>
                          {formatTimeAgo(entry.latest.updatedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEntry(entry.animeId)}
                        className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-xan-crimson hover:bg-transparent"
                        aria-label={`Remove ${entry.title} from history`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Episode chips */}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {sortedEps.map((ep) => {
                        const isLatest = ep.episodeId === entry.latest.episodeId;
                        return (
                          <Link
                            key={`${ep.animeId}-${ep.episodeId}`}
                            href={`/watch/${ep.animeId}?ep=${ep.episodeNumber}`}
                            className={
                              isLatest
                                ? "px-2 py-0.5 rounded-md text-[11px] font-bold border border-xan-crimson bg-xan-crimson text-white shadow-[0_0_12px_rgba(233,69,96,0.4)] hover:bg-xan-crimson/90 hover:border-xan-crimson transition-colors flex items-center gap-1"
                                : "px-2 py-0.5 rounded-md text-[11px] font-medium border border-xan-border bg-xan-card-hover hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson text-foreground/80 transition-colors flex items-center gap-1"
                            }
                            title={
                              isLatest
                                ? `Latest • EP ${ep.episodeNumber} • ${formatTimeAgo(ep.updatedAt)}`
                                : `EP ${ep.episodeNumber} • ${formatTimeAgo(ep.updatedAt)}`
                            }
                          >
                            {isLatest ? (
                              <>
                                <Clock className="h-2.5 w-2.5" />
                                <span className="text-[9px] font-bold uppercase tracking-wider">
                                  Last
                                </span>
                                {ep.episodeNumber}
                              </>
                            ) : (
                              <>
                                <span className="text-muted-foreground/70 text-[9px] font-bold">
                                  EP
                                </span>
                                {ep.episodeNumber}
                              </>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
