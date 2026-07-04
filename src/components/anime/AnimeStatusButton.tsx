"use client";

// components/anime/AnimeStatusButton.tsx
// ✅ Dropdown to mark an anime as Watching / Completed / Planning / Dropped / On Hold
// ✅ Reads + writes via useAnimeList hook (localStorage)

import { useState, useRef, useEffect } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  Eye,
  CheckCircle2,
  CalendarClock,
  XCircle,
  PauseCircle,
  Trash2,
} from "lucide-react";
import { useAnimeList, STATUS_LABELS, type AnimeStatus } from "@/hooks/useAnimeList";

interface AnimeStatusButtonProps {
  animeId: number;
  title: string;
  coverImage: string;
  episodes: number | null;
}

const STATUS_ICONS: Record<AnimeStatus, typeof Eye> = {
  WATCHING: Eye,
  COMPLETED: CheckCircle2,
  PLANNING: CalendarClock,
  DROPPED: XCircle,
  ON_HOLD: PauseCircle,
};

const STATUS_COLORS: Record<AnimeStatus | "none", string> = {
  none: "border-xan-border text-muted-foreground hover:text-foreground hover:bg-xan-card-hover",
  WATCHING: "border-xan-crimson/40 text-xan-crimson bg-xan-crimson/10",
  COMPLETED: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  PLANNING: "border-xan-violet/40 text-xan-violet bg-xan-violet/10",
  DROPPED: "border-zinc-500/40 text-zinc-400 bg-zinc-500/10",
  ON_HOLD: "border-amber-500/40 text-amber-400 bg-amber-500/10",
};

export function AnimeStatusButton({
  animeId,
  title,
  coverImage,
  episodes,
}: AnimeStatusButtonProps) {
  const { getEntry, setStatus, removeEntry } = useAnimeList();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const entry = getEntry(animeId);
  const currentStatus = entry?.status;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (status: AnimeStatus) => {
    setStatus(animeId, status, { title, coverImage, episodes });
    setOpen(false);
  };

  const handleRemove = () => {
    removeEntry(animeId);
    setOpen(false);
  };

  const statuses: AnimeStatus[] = ["WATCHING", "COMPLETED", "PLANNING", "ON_HOLD", "DROPPED"];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium border bg-xan-card transition-colors ${STATUS_COLORS[currentStatus ?? "none"]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {currentStatus ? (
          <>
            {(() => {
              const Icon = STATUS_ICONS[currentStatus];
              return <Icon className="h-4 w-4" />;
            })()}
            {STATUS_LABELS[currentStatus]}
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" />
            Add to List
          </>
        )}
        <ChevronDown className="h-3 w-3 ml-0.5 opacity-70" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-1 right-0 z-30 w-48 rounded-lg border border-xan-border bg-popover shadow-xl py-1 animate-panel-up"
        >
          {statuses.map((status) => {
            const Icon = STATUS_ICONS[status];
            const isActive = currentStatus === status;
            return (
              <button
                key={status}
                onClick={() => handleSelect(status)}
                role="option"
                aria-selected={isActive}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-foreground/90 hover:bg-xan-card-hover transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {STATUS_LABELS[status]}
                </span>
                {isActive && <Check className="h-3.5 w-3.5 text-xan-crimson" />}
              </button>
            );
          })}
          {currentStatus && (
            <>
              <div className="h-px bg-xan-border my-1" />
              <button
                onClick={handleRemove}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-xan-crimson hover:bg-xan-card-hover transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Remove from list
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
