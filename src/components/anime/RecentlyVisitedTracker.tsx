"use client";

// components/anime/RecentlyVisitedTracker.tsx
// ✅ Records a visit to the current anime detail page in localStorage
//    (for the Command Menu's "Recently Visited" section).
// ✅ Renders nothing — fire-and-forget side effect.

import { useEffect } from "react";
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited";

interface RecentlyVisitedTrackerProps {
  id: number;
  title: string;
  coverImage: string | null;
}

export function RecentlyVisitedTracker({
  id,
  title,
  coverImage,
}: RecentlyVisitedTrackerProps) {
  const { addVisit, isLoaded } = useRecentlyVisited();

  useEffect(() => {
    // ✅ Only record after the hook has hydrated (so we don't fight with
    //    other tabs writing to localStorage at the same time).
    if (!isLoaded) return;
    if (!id || !title) return;
    addVisit({ id, title, coverImage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, id]);

  return null;
}
