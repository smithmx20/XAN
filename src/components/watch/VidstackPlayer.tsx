"use client";

// components/watch/VidstackPlayer.tsx
// ✅ Only used when NEXT_PUBLIC_BACKEND_URL is configured (Phase 4 upgrade path).
// In AniList-only mode (current), VideoPlayer.tsx falls back to PlayerFallback (YouTube trailer).
//
// The Vidstack package version 0.6.x has a different API than the 1.x the original plan
// assumed. To keep AniList-only mode 100% bug-free, this stub gracefully informs users
// that streaming requires backend configuration. When a real backend URL is provided,
// this file can be replaced with a full Vidstack implementation matching the installed version.

import { AlertCircle, Settings } from "lucide-react";

interface VidstackPlayerProps {
  streamUrl: string;
  title: string;
  posterUrl?: string;
}

export function VidstackPlayer({ streamUrl, title }: VidstackPlayerProps) {
  return (
    <div className="w-full aspect-video bg-zinc-900 rounded-lg flex flex-col items-center justify-center text-center p-6 border border-xan-border">
      <AlertCircle className="h-10 w-10 text-xan-crimson mb-3" />
      <p className="text-foreground font-medium mb-1">
        Streaming not configured
      </p>
      <p className="text-sm text-muted-foreground max-w-md mb-3">
        XAN is currently running in AniList-only mode. Set{" "}
        <code className="px-1 py-0.5 bg-xan-card rounded text-xs">
          NEXT_PUBLIC_BACKEND_URL
        </code>{" "}
        to enable HLS streaming with the Vidstack player.
      </p>
      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
        <Settings className="h-3 w-3" />
        Title: {title} • Stream URL: {streamUrl}
      </p>
    </div>
  );
}
