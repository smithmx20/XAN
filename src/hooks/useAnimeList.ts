"use client";

// hooks/useAnimeList.ts
// ✅ MAL-style anime status lists — Watching / Completed / Planning / Dropped / On Hold
// ✅ localStorage-based, SSR-safe (same pattern as useWatchHistory)
// ✅ Each entry stores: animeId, status, progress (episodes watched), score, updatedAt

import { useState, useEffect, useCallback } from "react";

export type AnimeStatus = "WATCHING" | "COMPLETED" | "PLANNING" | "DROPPED" | "ON_HOLD";

export const STATUS_LABELS: Record<AnimeStatus, string> = {
  WATCHING: "Watching",
  COMPLETED: "Completed",
  PLANNING: "Plan to Watch",
  DROPPED: "Dropped",
  ON_HOLD: "On Hold",
};

export interface AnimeListEntry {
  animeId: number;
  title: string;
  coverImage: string;
  status: AnimeStatus;
  progress: number; // episodes watched (user-tracked, separate from watch history)
  score: number | null; // 1-10, null = unscored
  updatedAt: number;
}

const STORAGE_KEY = "xan-anime-list";
const MAX_ENTRIES = 500;

function readList(): AnimeListEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeList(entries: AnimeListEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

export function useAnimeList() {
  const [list, setList] = useState<AnimeListEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setList(readList());
    setIsLoaded(true);
  }, []);

  const setStatus = useCallback(
    (
      animeId: number,
      status: AnimeStatus,
      meta: { title: string; coverImage: string; episodes?: number | null },
    ) => {
      setList((prev) => {
        const filtered = prev.filter((e) => e.animeId !== animeId);
        const entry: AnimeListEntry = {
          animeId,
          title: meta.title,
          coverImage: meta.coverImage,
          status,
          progress: status === "COMPLETED" ? (meta.episodes ?? 0) : 0,
          score: null,
          updatedAt: Date.now(),
        };
        const updated = [entry, ...filtered];
        writeList(updated);
        return updated;
      });
    },
    [],
  );

  const removeEntry = useCallback((animeId: number) => {
    setList((prev) => {
      const filtered = prev.filter((e) => e.animeId !== animeId);
      writeList(filtered);
      return filtered;
    });
  }, []);

  const updateScore = useCallback((animeId: number, score: number | null) => {
    setList((prev) => {
      const updated = prev.map((e) =>
        e.animeId === animeId ? { ...e, score, updatedAt: Date.now() } : e,
      );
      writeList(updated);
      return updated;
    });
  }, []);

  const updateProgress = useCallback((animeId: number, progress: number) => {
    setList((prev) => {
      const updated = prev.map((e) =>
        e.animeId === animeId ? { ...e, progress, updatedAt: Date.now() } : e,
      );
      writeList(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setList([]);
    writeList([]);
  }, []);

  const getEntry = useCallback(
    (animeId: number): AnimeListEntry | undefined =>
      list.find((e) => e.animeId === animeId),
    [list],
  );

  return {
    list,
    isLoaded,
    setStatus,
    removeEntry,
    updateScore,
    updateProgress,
    clearAll,
    getEntry,
  };
}
