"use client";

// components/watch/PlayerFallback.tsx
// ✅ Bug #22: YouTube embed with proper sandbox + CSP attributes

import { useState } from "react";
import { Play, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlayerFallbackProps {
  trailerId: string | null;
  trailerSite: string | null;
  animeTitle: string;
}

export function PlayerFallback({
  trailerId,
  trailerSite,
  animeTitle,
}: PlayerFallbackProps) {
  const [playing, setPlaying] = useState(false);

  // No backend configured — show trailer (if YouTube) or info card
  if (!trailerId || trailerSite !== "youtube") {
    return (
      <div className="w-full aspect-video bg-zinc-900 rounded-lg flex flex-col items-center justify-center text-center p-6 border border-xan-border">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-foreground font-medium mb-1">
          No trailer available
        </p>
        <p className="text-sm text-muted-foreground max-w-md">
          XAN runs in AniList-only mode. Set{" "}
          <code className="px-1 py-0.5 bg-xan-card rounded text-xs">
            NEXT_PUBLIC_BACKEND_URL
          </code>{" "}
          to enable full episode streaming.
        </p>
      </div>
    );
  }

  // Lazy-load iframe on click (saves bandwidth + avoids autoplay surprise)
  if (!playing) {
    return (
      <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-xan-border group">
        {/* Thumbnail */}
        <img
          src={`https://img.youtube.com/vi/${trailerId}/hqdefault.jpg`}
          alt={`${animeTitle} trailer`}
          className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <button
            onClick={() => setPlaying(true)}
            className="w-16 h-16 rounded-full bg-xan-crimson/95 hover:bg-xan-crimson flex items-center justify-center shadow-xl scale-95 hover:scale-100 transition-all"
            aria-label="Play trailer"
          >
            <Play className="h-7 w-7 text-white fill-white ml-1" />
          </button>
          <p className="mt-4 text-sm text-white/90 font-medium">
            Watch Trailer
          </p>
          <p className="text-xs text-white/50 mt-0.5">
            Official trailer from YouTube
          </p>
        </div>

        <a
          href={`https://www.youtube.com/watch?v=${trailerId}`}
          target="_blank"
          rel="noreferrer"
          className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          YouTube
        </a>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden border border-xan-border bg-black">
      {/* ✅ Bug #22: YouTube embed with proper sandbox + CSP attributes */}
      <iframe
        src={`https://www.youtube.com/embed/${trailerId}?autoplay=1&rel=0`}
        title={`${animeTitle} trailer`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
