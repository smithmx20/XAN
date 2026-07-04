"use client";

// components/home/PopularGrid.tsx
// ✅ Converted from a static grid to a horizontal scroller with side buttons
//    so it matches the other home sections (Top 10, Continue Watching, etc.)

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/cards/AnimeCard";
import type { Anime, PageInfo } from "@/types/anime";

interface PopularGridProps {
  anime: Anime[];
  pageInfo?: PageInfo;
}

export function PopularGrid({ anime }: PopularGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 900);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-foreground">
            Popular Anime
          </h2>
          <p className="text-xs text-muted-foreground">
            All-time most-watched titles
          </p>
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
        className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-4 mask-fade-r"
      >
        {anime.map((item, idx) => (
          <div
            key={item.id}
            className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] snap-start"
          >
            <AnimeCard anime={item} index={idx} />
          </div>
        ))}
      </div>
    </section>
  );
}
