"use client";

// components/home/HeroCarousel.tsx
// ✅ "use client" — auto-rotate + active index state + Ken Burns

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Play, Info, Star, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTitle, sanitizeDescription, type Anime } from "@/types/anime";

interface HeroCarouselProps {
  anime: Anime[];
  /** Called when the active slide changes — used to sync ambient bg color */
  onActiveChange?: (color: string | null) => void;
}

const SLIDE_MS = 7000;

export function HeroCarousel({ anime, onActiveChange }: HeroCarouselProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slides = anime.slice(0, 5);

  const go = useCallback(
    (dir: 1 | -1) => {
      setActive((i) => (i + dir + slides.length) % slides.length);
    },
    [slides.length],
  );

  const goTo = useCallback(
    (i: number) => {
      setActive(((i % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  // Sync ambient color
  useEffect(() => {
    if (!onActiveChange) return;
    onActiveChange(slides[active]?.coverImage?.color ?? null);
  }, [active, slides, onActiveChange]);

  // Auto-rotate
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setTimeout(() => go(1), SLIDE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, paused, go, slides.length]);

  if (slides.length === 0) return null;

  const current = slides[active];
  const title = getTitle(current.title);
  const synopsis = sanitizeDescription(current.description);
  const banner =
    current.bannerImage ||
    current.coverImage?.large ||
    "/placeholder-card.png";
  const poster =
    current.coverImage?.large || "/placeholder-card.png";

  return (
    <section
      className="relative w-full h-[78vh] min-h-[520px] max-h-[760px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        // Only resume if focus is actually leaving the section (not moving
        // between two focusable children inside it).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      aria-roledescription="carousel"
      aria-label="Featured anime"
    >
      {/* ─── Blurred background slide (heavy blur) ─── */}
      <AnimatePresence mode="sync">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Image
            src={banner}
            alt=""
            aria-hidden
            fill
            priority={active === 0}
            sizes="100vw"
            className="object-cover scale-125 blur-2xl"
          />
        </motion.div>
      </AnimatePresence>

      {/* Color tint over blurred bg (subtle wash from cover color) */}
      <div
        className="absolute inset-0 opacity-25 mix-blend-soft-light"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${current.coverImage?.color ?? "#e94560"} 0%, transparent 60%)`,
        }}
      />

      {/* Strong gradient overlays for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-xan-dark via-xan-dark/70 to-xan-dark/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-xan-dark/95 via-xan-dark/55 to-xan-dark/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-xan-dark/50 via-transparent to-transparent" />

      {/* ─── Content row: info panel (left) + poster card (right) ─── */}
      <div className="relative h-full max-w-7xl mx-auto px-4 md:px-6 flex items-center">
        <div className="w-full flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-10 pt-16 md:pt-0">
          {/* Info panel (left, takes most width on desktop) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 max-w-2xl space-y-4 md:py-8"
            >
              {/* Trending badge */}
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-xan-crimson">
                <span className="inline-block w-8 h-px bg-xan-crimson" />
                #{active + 1} Trending Now
              </div>

              {/* Title */}
              <h1 className="font-display font-extrabold text-4xl md:text-6xl lg:text-7xl leading-[0.95] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
                {title}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/85">
                {current.averageScore != null && (
                  <span className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold">{current.averageScore}%</span>
                  </span>
                )}
                {current.seasonYear && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {current.season
                      ? `${current.season.charAt(0)}${current.season.slice(1).toLowerCase()} ${current.seasonYear}`
                      : current.seasonYear}
                  </span>
                )}
                {current.episodes != null && (
                  <span className="text-white/70">{current.episodes} eps</span>
                )}
                {current.format && (
                  <span className="px-2 py-0.5 rounded-md glass text-[11px] font-medium tracking-wider uppercase">
                    {current.format}
                  </span>
                )}
              </div>

              {/* Genres */}
              {current.genres && current.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {current.genres.slice(0, 4).map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/85 glass"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Synopsis */}
              {synopsis && (
                <p className="text-sm md:text-base text-white/75 line-clamp-2 max-w-xl leading-relaxed">
                  {synopsis}
                </p>
              )}

              {/* CTAs */}
              <div className="flex items-center gap-3 pt-2">
                <Link href={`/watch/${current.id}?ep=1`}>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-xan-crimson to-xan-violet text-white border-0 hover:opacity-90 shadow-[0_8px_30px_rgba(233,69,96,0.35)] rounded-full px-7 h-12 text-base font-semibold"
                  >
                    <Play className="h-5 w-5 fill-white mr-1.5" />
                    Watch Now
                  </Button>
                </Link>
                <Link href={`/anime/${current.id}`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="glass-strong text-white border-white/15 hover:bg-white/10 rounded-full px-7 h-12 text-base font-semibold"
                  >
                    <Info className="h-5 w-5 mr-1.5" />
                    More Info
                  </Button>
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Big square poster card (right side, desktop only) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`poster-${current.id}`}
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.97 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:block flex-shrink-0"
            >
              <Link
                href={`/anime/${current.id}`}
                className="block relative w-[320px] lg:w-[360px] aspect-[3/4] rounded-2xl overflow-hidden glass-strong p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] hover:shadow-[0_25px_70px_rgba(233,69,96,0.25)] transition-shadow duration-300 group"
              >
                <div className="relative w-full h-full rounded-xl overflow-hidden">
                  <Image
                    src={poster}
                    alt={title}
                    fill
                    priority={active === 0}
                    sizes="(max-width: 1280px) 320px, 360px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Glass top label */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase glass-strong text-white">
                      Featured
                    </span>
                    {current.averageScore != null && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold glass-strong text-white">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        {current.averageScore}%
                      </span>
                    )}
                  </div>
                  {/* Bottom gradient + title */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                    <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">
                      Now Trending
                    </p>
                    <p className="text-sm font-bold text-white line-clamp-1 mt-0.5">
                      {title}
                    </p>
                  </div>
                  {/* Hover play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-xan-crimson/95 flex items-center justify-center shadow-xl scale-90 group-hover:scale-100 transition-transform">
                      <Play className="h-6 w-6 text-white fill-white ml-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Arrows (desktop) */}
      <div className="absolute top-1/2 -translate-y-1/2 left-4 hidden md:block">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => go(-1)}
          aria-label="Previous slide"
          className="w-11 h-11 rounded-full glass-strong text-white hover:bg-white/15"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-4 hidden md:block">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => go(1)}
          aria-label="Next slide"
          className="w-11 h-11 rounded-full glass-strong text-white hover:bg-white/15"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 flex items-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active
                ? "w-8 bg-xan-crimson"
                : "w-2 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
