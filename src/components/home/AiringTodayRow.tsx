"use client";

// components/home/AiringTodayRow.tsx
// ✅ Horizontal scroller showing anime with new episodes airing TODAY.
// ✅ Matches the visual style of xancld.xyz's "Airing Today" section:
//    calendar icon, "Airing Today" heading, "New episodes dropping today."
//    subtitle, portrait cards with score badge, title, and EP X badge for
//    the episode number airing today.

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTitle, type AiringSchedule } from "@/types/anime";

interface AiringTodayRowProps {
  schedules: AiringSchedule[];
}

/**
 * Airing Today — horizontal scroller of anime with new episodes dropping today.
 * Caller should already have deduplicated by anime id and sorted by airingAt asc.
 * Each card shows the episode number that's airing today as a small badge.
 */
export function AiringTodayRow({ schedules }: AiringTodayRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = schedules.slice(0, 20);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 900);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-xan-violet to-xan-crimson flex items-center justify-center">
            <CalendarClock className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-foreground flex items-center gap-2">
              Airing Today
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-xan-violet/15 text-xan-violet border border-xan-violet/25">
                New
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              New episodes dropping today.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scrollBy("left")}
            aria-label="Scroll left"
            className="rounded-full glass border-xan-border hover:bg-white/10 h-8 w-8 md:h-9 md:w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scrollBy("right")}
            aria-label="Scroll right"
            className="rounded-full glass border-xan-border hover:bg-white/10 h-8 w-8 md:h-9 md:w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-4 mask-fade-r"
      >
        {items.map((s, idx) => {
          const media = s.media;
          if (!media) return null;
          const title = getTitle(media.title);
          const image = media.coverImage?.large ?? "/placeholder-card.png";
          const color = media.coverImage?.color ?? "#e94560";

          return (
            <motion.div
              key={`${media.id}-${s.id}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.4,
                delay: Math.min(idx * 0.04, 0.4),
                ease: [0.25, 0.4, 0.25, 1],
              }}
              className="flex-shrink-0 snap-start group"
              style={{ width: "clamp(120px, 32vw, 170px)" }}
            >
              <Link
                href={`/watch/${media.id}?ep=${s.episode}`}
                className="relative block w-full rounded-xl overflow-hidden bg-xan-card border border-xan-border transition-all duration-300 group-hover:border-xan-violet/60 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)] group-hover:-translate-y-1"
                style={{ aspectRatio: "2 / 3" }}
              >
                <Image
                  src={image}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 120px, 170px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                {/* Score badge (top-right) */}
                {media.averageScore != null && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">
                    <span className="text-yellow-400">★</span>
                    {media.averageScore}%
                  </div>
                )}

                {/* "EP X" badge (top-left) — episode number airing today */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-xan-violet/95 backdrop-blur-sm text-white shadow-md">
                  EP {s.episode}
                </div>

                {/* Title block */}
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <h3 className="font-medium text-xs text-white line-clamp-2 leading-tight">
                    {title}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/60">
                    {media.format && (
                      <span className="uppercase tracking-wider">
                        {media.format}
                      </span>
                    )}
                    {media.seasonYear && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-white/30" />
                        <span>{media.seasonYear}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Color accent bottom line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: color }}
                />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
