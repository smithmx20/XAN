// app/(app)/season/page.tsx
// Server Component (async) — full This Season view powered by Jikan

import { fetchJikanSeasonNow } from "@/lib/jikan";
import { JikanAnimeCard } from "@/components/jikan/JikanAnimeCard";
import { ErrorCard } from "@/components/ErrorCard";
import { Calendar } from "lucide-react";
import Link from "next/link";

export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function SeasonPage({ searchParams }: PageProps) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);

  const result = await fetchJikanSeasonNow(page);

  const month = new Date().getMonth();
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
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6 text-emerald-500" />
          This Season
          <span className="text-xs font-bold text-white bg-emerald-600 px-2 py-0.5 rounded uppercase tracking-wider">
            {seasonName} {year}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Currently airing anime · data from{" "}
          <a
            href="https://jikan.moe"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:underline"
          >
            Jikan
          </a>{" "}
          (MyAnimeList)
        </p>
      </div>

      {!result || result.data.length === 0 ? (
        <ErrorCard message="Couldn't load this season's anime" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {result.data.map((item, idx) => (
              <JikanAnimeCard
                key={item.mal_id}
                anime={item}
                index={idx}
                source="season"
              />
            ))}
          </div>

          {page > 1 || result.hasNextPage ? (
            <div className="flex items-center justify-center gap-3 pt-4">
              <a
                href={page > 1 ? `/season?page=${page - 1}` : "#"}
                aria-disabled={page <= 1}
                className={`inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover ${
                  page <= 1 ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                Previous
              </a>
              <span className="text-sm text-muted-foreground px-3">
                Page {page}
                {result.lastPage ? ` of ${result.lastPage}` : ""}
              </span>
              <a
                href={result.hasNextPage ? `/season?page=${page + 1}` : "#"}
                aria-disabled={!result.hasNextPage}
                className={`inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover ${
                  !result.hasNextPage ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                Next
              </a>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
