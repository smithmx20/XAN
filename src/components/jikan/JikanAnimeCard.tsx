"use client";

// components/jikan/JikanAnimeCard.tsx
// ✅ Card variant for Jikan (MyAnimeList) data — links to the AniList search
// by title so users still get the full AniList experience (detail page + watch).

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Star, Play, Award, Users } from "lucide-react";
import { getJikanTitle, getJikanCover, type JikanAnime } from "@/lib/jikan";

interface JikanAnimeCardProps {
  anime: JikanAnime;
  index?: number;
  source?: "mal" | "season";
}

export function JikanAnimeCard({
  anime,
  index = 0,
  source = "mal",
}: JikanAnimeCardProps) {
  const title = getJikanTitle(anime);
  const cover = getJikanCover(anime);
  const score = anime.score != null ? anime.score.toFixed(1) : null;
  const rank = anime.rank;
  const members = anime.members;
  const year = anime.year;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.03, 0.3),
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className="group relative"
    >
      <Link
        href={`/search?q=${encodeURIComponent(title)}`}
        className="block"
        aria-label={`Search ${title} on XAN`}
      >
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-xan-card border border-xan-border transition-all duration-300 group-hover:border-xan-crimson/40 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <Image
            src={cover}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

          {/* Top-left badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {score && (
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-white w-fit">
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                {score}
              </div>
            )}
            {rank != null && rank <= 50 && source === "mal" && (
              <div className="flex items-center gap-1 bg-gradient-to-r from-xan-crimson/90 to-xan-violet/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-white w-fit">
                <Award className="h-3 w-3" />
                #{rank}
              </div>
            )}
            {source === "season" && anime.airing && (
              <div className="bg-emerald-500/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-white w-fit">
                Airing
              </div>
            )}
          </div>

          {/* Top-right MAL badge */}
          <div className="absolute top-2 right-2">
            <div className="bg-blue-600/80 backdrop-blur-sm rounded text-[9px] font-bold text-white px-1.5 py-0.5 uppercase tracking-wider">
              MAL
            </div>
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
              {anime.type && <span>{anime.type}</span>}
              {year && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span>{year}</span>
                </>
              )}
              {members != null && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span className="flex items-center gap-0.5">
                    <Users className="h-2.5 w-2.5" />
                    {members >= 1000000
                      ? `${(members / 1000000).toFixed(1)}M`
                      : members >= 1000
                        ? `${(members / 1000).toFixed(0)}K`
                        : members}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
