"use client";

// components/jikan/RandomAnimeButton.tsx
// ✅ "Surprise me" button — fetches a random anime from Jikan and routes to search.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJikanTitle, type JikanAnime } from "@/lib/jikan";

export function RandomAnimeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jikan/random");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      const anime: JikanAnime | undefined = json?.data;
      if (!anime) throw new Error("No anime returned");
      router.push(`/search?q=${encodeURIComponent(getJikanTitle(anime))}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={handleClick}
        disabled={loading}
        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90 text-white border-0"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Finding anime…
          </>
        ) : (
          <>
            <Shuffle className="h-4 w-4 mr-2" />
            Surprise Me
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-muted-foreground">Couldn&apos;t load: {error}</p>
      )}
    </div>
  );
}
