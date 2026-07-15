"use client";

// hooks/useRecentlyVisited.ts
// ✅ SSR-safe localStorage hook that tracks the last 8 anime detail page visits.
// ✅ Cross-tab sync — when another tab adds a visit, this tab picks it up via
//    the `storage` event (no BroadcastChannel needed).
// ✅ Dedupes by id — revisiting an existing entry promotes it to the top
//    instead of duplicating.
// ✅ Trims to MAX_ITEMS (8) on every write.

import { useState, useEffect, useCallback } from "react";

export interface RecentlyVisitedItem {
  id: number;
  title: string;
  coverImage: string | null;
  visitedAt: number; // Date.now()
}

const STORAGE_KEY = "xan-recently-visited";
const MAX_ITEMS = 8;

function readItems(): RecentlyVisitedItem[] {
  if (typeof window === "undefined") return []; // SSR guard
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        typeof item?.id === "number" &&
        typeof item?.title === "string" &&
        typeof item?.visitedAt === "number",
    );
  } catch {
    return [];
  }
}

function writeItems(items: RecentlyVisitedItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_ITEMS)),
    );
  } catch {
    // ignore quota errors
  }
}

export function useRecentlyVisited() {
  const [items, setItems] = useState<RecentlyVisitedItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // ✅ Hydrate from localStorage after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    setItems(readItems());
    setIsLoaded(true);

    // ✅ Cross-tab sync: another tab wrote to localStorage → refresh our state.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setItems(readItems());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addVisit = useCallback(
    (item: Omit<RecentlyVisitedItem, "visitedAt">) => {
      // ✅ Read fresh from localStorage in case other tabs updated it.
      const current = readItems();
      const filtered = current.filter((i) => i.id !== item.id);
      const updated = [
        { ...item, visitedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_ITEMS);
      writeItems(updated);
      setItems(updated);
    },
    [],
  );

  const clearRecentlyVisited = useCallback(() => {
    writeItems([]);
    setItems([]);
  }, []);

  return {
    items,
    isLoaded,
    addVisit,
    clearRecentlyVisited,
  };
}
