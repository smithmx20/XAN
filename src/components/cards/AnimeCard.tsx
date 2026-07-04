"use client";

// components/cards/AnimeCard.tsx
// ✅ Uses CSS-only .card-enter animation (globals.css) instead of motion/react
//    whileInView — avoids one IntersectionObserver per card on grid pages.

import Image from "next/image";
import Link from "next/link";
import { Star, Play, Clock } from "lucide-react";
import { BookmarkButton } from "@/components/cards/BookmarkButton";
import {
  getTitle,
  formatScore,
  formatEpisodes,
  type Anime,
} from "@/types/anime";

interface AnimeCardProps {
  anime: Anime;
  index?: number;
  priority?: boolean;
}

export function AnimeCard({ anime, index = 0, priority = false }: AnimeCardProps) {
  const title = getTitle(anime.title);
  const image =
    anime.coverImage?.large ?? "/placeholder-card.png";
  const score = formatScore(anime.averageScore);
  const episodes = formatEpisodes(anime.episodes);
  const color = anime.coverImage?.color ?? "#e94560";

  return (
    <div
      className="group relative card-enter"
      style={{ "--card-index": index } as React.CSSProperties}
    >
      <Link href={`/anime/${anime.id}`} className="block">
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-xan-card border border-xan-border transition-all duration-300 group-hover:border-xan-crimson/40 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          {/* Cover image */}
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

          {/* Top badges (left side only — bookmark lives top-right) */}
          <div className="absolute top-2 left-2 flex items-start gap-2 pointer-events-none">
            {anime.averageScore != null && (
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                {score}
              </div>
            )}
            {anime.format === "MOVIE" && (
              <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-medium text-white/80 uppercase tracking-wider">
                Movie
              </div>
            )}
          </div>

          {/* Bookmark button (top-right, hover-reveal on desktop) */}
          <div className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <BookmarkButton
              animeId={anime.id}
              title={title}
              coverImage={image}
              size="sm"
            />
          </div>

          {/* Hover play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-xan-crimson/90 backdrop-blur-sm flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-medium text-sm text-white line-clamp-2 leading-snug">
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/60">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {episodes}
              </span>
              {anime.seasonYear && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span>{anime.seasonYear}</span>
                </>
              )}
            </div>
          </div>

          {/* Color accent line */}
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: color }}
          />
        </div>
      </Link>
    </div>
  );
}
