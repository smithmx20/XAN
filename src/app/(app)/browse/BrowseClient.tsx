"use client";

// app/(app)/browse/page.tsx
// ✅ Premium glass search bar (h-12, rounded-full, focus glow)
// ✅ Horizontal scrollable genre chips — multi-select with numbered badges showing selection order
// ✅ Sort dropdown (native select)
// ✅ Format dropdown (native select)
// ✅ Active filter chips — one-click remove with X icon
// ✅ Clear all button
// ✅ Premium anime grid (5 columns desktop)
// ✅ Pagination (pill buttons)
// ✅ Premium empty state with "Clear filters" CTA
// ✅ URL-synced filters (q, genres, sort, format)
// ✅ Debounced search (400ms)

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, X, ChevronLeft, ChevronRight, SlidersHorizontal, Compass } from "lucide-react";
import { AnimeCard } from "@/components/cards/AnimeCard";
import { AnimeCardSkeleton } from "@/components/cards/AnimeCardSkeleton";
import { GENRES, SORT_OPTIONS, FORMATS } from "@/lib/constants";
import type { Anime, PageInfo } from "@/types/anime";
import { cn } from "@/lib/utils";

const PER_PAGE = 25;

export function BrowseClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ─── URL-synced filter state ───
  const q = searchParams.get("q") ?? "";
  const genresParam = searchParams.get("genres") ?? "";
  const selectedGenres = useMemo(
    () => genresParam.split(",").filter(Boolean),
    [genresParam],
  );
  const sort = searchParams.get("sort") ?? "POPULARITY_DESC";
  const format = searchParams.get("format") ?? "";
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);

  // ─── Local state for the debounced search input ───
  const [searchInput, setSearchInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local search input when URL `q` changes (e.g. user hits back)
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // ─── URL update helper ───
  const updateUrl = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === 0) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }
      // Any filter change resets to page 1
      if (!("page" in updates)) params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // ─── Debounced search input → URL ───
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== q) {
        updateUrl({ q: searchInput.trim() || null });
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, q, updateUrl]);

  // ─── Genre toggle (with selection-order badges) ───
  const toggleGenre = (genre: string) => {
    const current = selectedGenres;
    const next = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre];
    updateUrl({ genres: next.length > 0 ? next.join(",") : null });
  };
  const genreOrder = (genre: string) =>
    selectedGenres.indexOf(genre) + 1;

  // ─── Format change ───
  const changeFormat = (value: string) => {
    updateUrl({ format: value || null });
  };

  // ─── Sort change ───
  const changeSort = (value: string) => {
    updateUrl({ sort: value });
  };

  // ─── Active filter chips (q + genres + format) ───
  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];
  if (q) {
    activeFilters.push({
      key: "q",
      label: `Search: "${q}"`,
      onRemove: () => {
        setSearchInput("");
        updateUrl({ q: null });
      },
    });
  }
  for (const g of selectedGenres) {
    activeFilters.push({
      key: `genre-${g}`,
      label: g,
      onRemove: () => toggleGenre(g),
    });
  }
  if (format) {
    activeFilters.push({
      key: "format",
      label: `Format: ${format}`,
      onRemove: () => changeFormat(""),
    });
  }

  // ─── Data fetch ───
  const [data, setData] = useState<Anime[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("q", q);
    params.set("page", String(page));
    params.set("perPage", String(PER_PAGE));
    if (sort) params.set("sort", sort);
    if (format) params.set("format", format);
    if (selectedGenres.length > 0)
      params.set("genres", selectedGenres.join(","));

    fetch(`/api/search?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(Array.isArray(json?.data) ? json.data : []);
        setPageInfo(json?.pageInfo ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Browse]", err);
        setError("Failed to load anime. Please try again.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, page, sort, format, selectedGenres.join(",")]);

  // ─── Pagination handlers ───
  const goToPage = (p: number) => {
    updateUrl({ page: p > 1 ? p : null });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ─── Clear all ───
  const clearAll = () => {
    setSearchInput("");
    router.push(pathname, { scroll: false });
  };

  const hasFilters = q || selectedGenres.length > 0 || format;
  const isEmpty = !loading && !error && data.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center flex-shrink-0">
          <Compass className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground">
            Browse Anime
          </h1>
          <p className="text-sm text-muted-foreground">
            Filter by genre, format, and sort to discover your next watch.
          </p>
        </div>
      </div>

      {/* ─── Premium glass search bar ─── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search by title…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full h-12 pl-11 pr-4 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-all focus:border-xan-crimson/40 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(233,69,96,0.12)]"
        />
      </div>

      {/* ─── Genre chips (horizontal scroll, multi-select with order badges) ─── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {GENRES.map((genre) => {
          const isSelected = selectedGenres.includes(genre);
          const order = isSelected ? genreOrder(genre) : 0;
          return (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={cn(
                "flex-shrink-0 h-9 px-3.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                isSelected
                  ? "bg-xan-crimson/15 border-xan-crimson/40 text-xan-crimson"
                  : "bg-white/[0.04] border-white/8 text-muted-foreground hover:text-foreground hover:border-white/15",
              )}
            >
              {genre}
              {isSelected && (
                <span className="w-4 h-4 rounded-full bg-xan-crimson text-white text-[9px] font-bold flex items-center justify-center">
                  {order}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Sort + Format dropdowns + Clear ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
            className="h-9 px-3 pr-8 rounded-full bg-white/[0.04] border border-white/8 text-xs text-foreground outline-none focus:border-xan-crimson/40 cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-xan-dark">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Format
          </label>
          <select
            value={format}
            onChange={(e) => changeFormat(e.target.value)}
            className="h-9 px-3 pr-8 rounded-full bg-white/[0.04] border border-white/8 text-xs text-foreground outline-none focus:border-xan-crimson/40 cursor-pointer"
          >
            <option value="" className="bg-xan-dark">
              Any
            </option>
            {FORMATS.map((f) => (
              <option key={f} value={f} className="bg-xan-dark">
                {f}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={clearAll}
            className="ml-auto h-9 px-3 rounded-full bg-white/[0.04] border border-white/8 text-xs text-muted-foreground hover:text-xan-crimson hover:border-xan-crimson/30 transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      {/* ─── Active filter chips ─── */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((f) => (
            <button
              key={f.key}
              onClick={f.onRemove}
              className="h-7 px-2.5 rounded-full bg-xan-crimson/10 border border-xan-crimson/25 text-[11px] text-foreground hover:bg-xan-crimson/20 transition-colors flex items-center gap-1.5"
            >
              {f.label}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* ─── Result count ─── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {loading
            ? "Loading…"
            : pageInfo?.total
              ? `${pageInfo.total.toLocaleString()} anime found`
              : data.length > 0
                ? `Showing ${data.length} anime`
                : "No anime found"}
        </span>
        {pageInfo && pageInfo.total != null && (
          <span className="font-mono">
            Page {pageInfo.currentPage}
            {pageInfo.lastPage ? ` of ${pageInfo.lastPage}` : ""}
          </span>
        )}
      </div>

      {/* ─── Anime grid ─── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-xan-border bg-xan-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : isEmpty ? (
        /* ─── Premium empty state ─── */
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
            <Search className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            No anime found
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Try adjusting your filters or search terms to find what you&apos;re
            looking for.
          </p>
          <button
            onClick={clearAll}
            className="h-9 px-5 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data.map((anime, i) => (
            <AnimeCard key={anime.id} anime={anime} index={i} />
          ))}
        </div>
      )}

      {/* ─── Pagination ─── */}
      {!loading && !error && data.length > 0 && pageInfo && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className={cn(
              "h-9 px-4 rounded-full text-xs font-medium border transition-all flex items-center gap-1",
              page <= 1
                ? "opacity-40 cursor-not-allowed border-white/8 text-muted-foreground"
                : "border-white/8 bg-white/[0.04] text-foreground hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>

          {/* Page number pills */}
          {getPageList(pageInfo.currentPage, pageInfo.lastPage).map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="w-9 h-9 flex items-center justify-center text-muted-foreground text-xs"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={cn(
                  "w-9 h-9 rounded-full text-xs font-medium border transition-all flex items-center justify-center",
                  p === pageInfo.currentPage
                    ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white border-transparent"
                    : "border-white/8 bg-white/[0.04] text-foreground hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson",
                )}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={!pageInfo.hasNextPage}
            className={cn(
              "h-9 px-4 rounded-full text-xs font-medium border transition-all flex items-center gap-1",
              !pageInfo.hasNextPage
                ? "opacity-40 cursor-not-allowed border-white/8 text-muted-foreground"
                : "border-white/8 bg-white/[0.04] text-foreground hover:border-xan-crimson/40 hover:bg-xan-crimson/10 hover:text-xan-crimson",
            )}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helper: build a sensible page list with ellipses ───
function getPageList(current: number, last: number | null): (number | "…")[] {
  if (!last) return [current];
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);

  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < last - 1) out.push("…");

  out.push(last);
  return out;
}
