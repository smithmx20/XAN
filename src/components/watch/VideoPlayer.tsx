"use client";

// components/watch/VideoPlayer.tsx
// ✅ Bug #22: Vidstack uses browser APIs — must disable SSR via dynamic import
// In AniList-only mode (no backend), we always fall back to YouTube trailer.

import dynamic from "next/dynamic";
import { PlayerFallback } from "./PlayerFallback";

interface VideoPlayerProps {
  trailerId: string | null;
  trailerSite: string | null;
  animeTitle: string;
  // Reserved for backend-enabled mode (Phase 4 upgrade path)
  streamUrl?: string | null;
}

// ✅ Dynamic import only when a real stream URL exists (Phase 4 upgrade path)
const VidstackPlayer = dynamic(
  () => import("./VidstackPlayer").then((mod) => mod.VidstackPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-video bg-zinc-900 animate-shimmer rounded-lg" />
    ),
  },
);

export function VideoPlayer({
  trailerId,
  trailerSite,
  animeTitle,
  streamUrl,
}: VideoPlayerProps) {
  // If a real stream URL exists, use the actual player (Phase 4 upgrade path)
  if (streamUrl) {
    return (
      <VidstackPlayer streamUrl={streamUrl} title={animeTitle} />
    );
  }

  // AniList-only mode — show trailer fallback
  return (
    <PlayerFallback
      trailerId={trailerId}
      trailerSite={trailerSite}
      animeTitle={animeTitle}
    />
  );
}
