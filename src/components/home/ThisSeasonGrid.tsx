// components/home/ThisSeasonGrid.tsx
// Server Component — fetches currently airing anime from Jikan

import { fetchJikanSeasonNow } from "@/lib/jikan";
import { JikanAnimeCard } from "@/components/jikan/JikanAnimeCard";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

export const revalidate = 3600;

export async function ThisSeasonGrid() {
  const result = await fetchJikanSeasonNow(1);
  if (!result || result.data.length === 0) {
    return null;
  }

  const now = result.data.slice(0, 15);

  // Compute current season label
  const month = new Date().getMonth(); // 0-11
  const seasonName =
    month <= 1 || month === 11
      ? "Winter"
      : month <= 4
        ? "Spring"
        : month <= 7
          ? "Summer"
          : "Fall";
  const year = new Date().getFullYear();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-foreground flex items-center gap-2">
              This Season
              <span className="text-[10px] font-bold text-white bg-emerald-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                {seasonName} {year}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Currently airing anime · via Jikan API
            </p>
          </div>
        </div>
        <Link
          href="/season"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-2">
        {now.map((item, idx) => (
          <div
            key={item.mal_id}
            className="flex-shrink-0 w-[150px] sm:w-[160px] md:w-[180px] snap-start"
          >
            <JikanAnimeCard anime={item} index={idx} source="season" />
          </div>
        ))}
      </div>
    </section>
  );
}
