"use client";

// app/(app)/search/page.tsx
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search as SearchIcon, SearchX, X } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterPanel } from "@/components/search/FilterPanel";
import { AnimeCard } from "@/components/cards/AnimeCard";
import { AnimeCardSkeleton } from "@/components/cards/AnimeCardSkeleton";
import { ErrorCard } from "@/components/ErrorCard";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { SORT_OPTIONS, TAGS } from "@/lib/constants";
import type { Anime, PageInfo } from "@/types/anime";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, i) => (
              <AnimeCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQ = searchParams.get("q") || "";
  const initialGenres = searchParams.get("genres")?.split(",").filter(Boolean) ?? [];
  const initialTags = searchParams.get("tags")?.split(",").filter(Boolean) ?? [];
  const initialSort = searchParams.get("sort") || "POPULARITY_DESC";
  const initialFormat = searchParams.get("format") || "";

  const [query, setQuery] = useState(initialQ);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenres);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [sort, setSort] = useState(initialSort);
  const [format, setFormat] = useState(initialFormat);
  const [data, setData] = useState<Anime[] | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (selectedGenres.length > 0) params.set("genres", selectedGenres.join(","));
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    if (sort && sort !== "POPULARITY_DESC") params.set("sort", sort);
    if (format) params.set("format", format);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    setPage(1);
  }, [debouncedQuery, selectedGenres, selectedTags, sort, format, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({ page: String(page), perPage: "24", sort });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (selectedGenres.length > 0) params.set("genres", selectedGenres.join(","));
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    if (format) params.set("format", format);

    fetch(`/api/search?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        if (!cancelled) {
          setData((json?.data ?? []) as Anime[]);
          setPageInfo(json?.pageInfo ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, selectedGenres, selectedTags, sort, format, page]);

  const handleGenreToggle = useCallback((genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <SearchIcon className="h-6 w-6 text-xan-crimson" />
          Search
        </h1>
        <p className="text-sm text-muted-foreground">
          Find anime by title, filter by genre or demographic, and sort however you like.
        </p>
      </div>

      <SearchBar value={query} onChange={setQuery} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <FilterPanel
          selectedGenres={selectedGenres}
          onGenreToggle={handleGenreToggle}
          onClearGenres={() => setSelectedGenres([])}
          selectedTags={selectedTags}
          onTagToggle={handleTagToggle}
          onClearTags={() => setSelectedTags([])}
          sort={sort}
          onSortChange={setSort}
          format={format}
          onFormatChange={setFormat}
          total={data?.length}
        />

        <div className="space-y-4 min-w-0">
          {/* Active filter chips */}
          {(() => {
            const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label;
            const tagLabels = selectedTags.map(
              (t) => TAGS.find((tag) => tag.value === t)?.label ?? t,
            );
            const chips: { label: string; onRemove: () => void }[] = [];
            if (debouncedQuery) chips.push({ label: `"${debouncedQuery}"`, onRemove: () => setQuery("") });
            if (format) chips.push({ label: format, onRemove: () => setFormat("") });
            if (sortLabel && sort !== "POPULARITY_DESC") chips.push({ label: `Sort: ${sortLabel}`, onRemove: () => setSort("POPULARITY_DESC") });
            selectedGenres.forEach((g) => chips.push({ label: g, onRemove: () => handleGenreToggle(g) }));
            tagLabels.forEach((label, i) => chips.push({ label, onRemove: () => handleTagToggle(selectedTags[i]) }));

            if (chips.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center gap-2">
                {chips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-xan-card border border-xan-border hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson text-foreground/80 transition-colors"
                  >
                    {chip.label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                <button
                  onClick={() => {
                    setQuery("");
                    setFormat("");
                    setSort("POPULARITY_DESC");
                    setSelectedGenres([]);
                    setSelectedTags([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-xan-crimson transition-colors ml-1"
                >
                  Clear all
                </button>
              </div>
            );
          })()}

          {error ? (
            <ErrorCard message="Search failed. Please try again." />
          ) : loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 12 }, (_, i) => (
                <AnimeCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {data.map((item, idx) => (
                  <AnimeCard key={item.id} anime={item} index={idx} />
                ))}
              </div>

              {pageInfo && (page > 1 || pageInfo.hasNextPage) && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="bg-xan-card border-xan-border hover:bg-xan-card-hover disabled:opacity-40"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {page}
                    {pageInfo.lastPage ? ` of ${pageInfo.lastPage}` : ""}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={!pageInfo.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                    className="bg-xan-card border-xan-border hover:bg-xan-card-hover disabled:opacity-40"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-xan-border bg-xan-card/50 py-16 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">No results found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different search term or adjust filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
