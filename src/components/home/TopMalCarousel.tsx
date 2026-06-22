// components/home/TopMalCarousel.tsx
// Server Component — fetches top anime from Jikan (MyAnimeList)

import { fetchJikanTop } from "@/lib/jikan";
import { JikanAnimeCard } from "@/components/jikan/JikanAnimeCard";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

export const revalidate = 3600; // 1 hour

export async function TopMalCarousel() {
  const result = await fetchJikanTop(1, "tv");
  if (!result || result.data.length === 0) {
    return null;
  }

  const top = result.data.slice(0, 15);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-foreground flex items-center gap-2">
              Top on MyAnimeList
              <span className="text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                MAL
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Highest-rated TV anime of all time · via Jikan API
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-2">
        {top.map((item, idx) => (
          <div
            key={item.mal_id}
            className="flex-shrink-0 w-[150px] sm:w-[160px] md:w-[180px] snap-start"
          >
            <JikanAnimeCard anime={item} index={idx} source="mal" />
          </div>
        ))}
      </div>
    </section>
  );
}
