"use client";

// components/command/CommandMenu.tsx
// ✅ Opens with Cmd/Ctrl+K or "/" (when not in an input)
// ✅ Live AniList anime search — debounced 300ms fetch to /api/search, cover thumbnails
// ✅ Recently Visited — from useRecentlyVisited (max 8)
// ✅ Continue Watching — from useWatchHistory (one-click resume to exact episode)
// ✅ Bookmarks — from useBookmarks
// ✅ Trending Now — fetched from AniList top 5 (lazy, on first open)
// ✅ Page Navigation — Home, Discover, Browse, Schedule, Library, Stats, History, Settings
// ✅ Keyboard navigation (↑↓ move, Enter select, Escape close)
// ✅ Glass palette with animated entrance
// ✅ Category labels with item counts
// ✅ Cover image thumbnails for anime items
// ✅ Auto-scroll active item into view

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  Home as HomeIcon,
  Compass,
  Calendar,
  Library,
  History as HistoryIcon,
  Settings,
  BarChart3,
  LayoutGrid,
  Flame,
  Bookmark,
  Play,
  Clock,
  CornerDownLeft,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useBookmarks } from "@/hooks/useBookmarks";
import type { Anime } from "@/types/anime";
import { cn } from "@/lib/utils";

// ─── Types ───
interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  cover?: string | null;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface CommandGroup {
  id: string;
  label: string;
  items: CommandItem[];
}

// ─── Page nav links ───
const PAGE_NAV: CommandItem[] = [
  { id: "nav-home", label: "Home", href: "/home", icon: HomeIcon },
  { id: "nav-discover", label: "Discover", href: "/discover", icon: Compass },
  { id: "nav-browse", label: "Browse", href: "/browse", icon: LayoutGrid },
  { id: "nav-schedule", label: "Schedule", href: "/schedule", icon: Calendar },
  { id: "nav-library", label: "Library", href: "/list", icon: Library },
  { id: "nav-stats", label: "Stats", href: "/history", icon: BarChart3 },
  { id: "nav-history", label: "History", href: "/history", icon: HistoryIcon },
  { id: "nav-settings", label: "Settings", href: "/settings", icon: Settings },
];

// ─── Public API: open the menu programmatically ───
// We use a tiny event-based bridge so the Navbar button can trigger open
// without prop drilling.
const OPEN_EVENT = "xan:open-command-menu";
export function openCommandMenu() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trending, setTrending] = useState<Anime[]>([]);
  const [trendingLoaded, setTrendingLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { items: recentItems, isLoaded: recentLoaded } = useRecentlyVisited();
  const { history, isLoaded: historyLoaded } = useWatchHistory();
  const { bookmarks, isLoaded: bookmarksLoaded } = useBookmarks();

  // ─── Open via custom event (Navbar button) ───
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  // ─── Open via Cmd/Ctrl+K or "/" ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" — only when not typing in an input/textarea/contenteditable
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const isEditable =
          tag === "input" ||
          tag === "textarea" ||
          target?.isContentEditable === true;
        if (!isEditable) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // ─── Reset state on open ───
  useEffect(() => {
    if (open) {
      setQuery("");
      setSearchResults([]);
      setActiveIndex(0);
      // Focus input on next tick (after animation)
      setTimeout(() => inputRef.current?.focus(), 50);

      // Lazy-load trending on first open
      if (!trendingLoaded) {
        fetchTrending().then((items) => {
          setTrending(items);
          setTrendingLoaded(true);
        });
      }
    }
  }, [open, trendingLoaded]);

  // ─── Debounced live search ───
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}&perPage=8`,
        );
        if (!res.ok) throw new Error("search failed");
        const json = await res.json();
        setSearchResults(Array.isArray(json?.data) ? json.data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ─── Build groups based on current state ───
  const groups: CommandGroup[] = useMemo(() => {
    const list: CommandGroup[] = [];

    // Search results take over when query is set
    if (query.trim()) {
      list.push({
        id: "search",
        label: `Search Results${searchResults.length > 0 ? ` · ${searchResults.length}` : ""}`,
        items: searchResults.map((a) => ({
          id: `search-${a.id}`,
          label:
            a.title.english ?? a.title.romaji ?? a.title.native ?? "Untitled",
          hint: a.seasonYear ? String(a.seasonYear) : undefined,
          href: `/anime/${a.id}`,
          cover: a.coverImage?.large ?? null,
          badge: a.averageScore ? `${a.averageScore}%` : undefined,
        })),
      });
      return list;
    }

    // Recently visited
    if (recentLoaded && recentItems.length > 0) {
      list.push({
        id: "recent",
        label: `Recently Visited · ${recentItems.length}`,
        items: recentItems.map((item) => ({
          id: `recent-${item.id}`,
          label: item.title,
          href: `/anime/${item.id}`,
          cover: item.coverImage ?? null,
        })),
      });
    }

    // Continue watching
    if (historyLoaded && history.length > 0) {
      const continueItems = history.slice(0, 5).map((h) => ({
        id: `continue-${h.animeId}-${h.episodeId}`,
        label: h.title,
        hint: `Ep ${h.episodeNumber}`,
        href: `/watch/${h.animeId}?ep=${h.episodeNumber}&t=${Math.floor(h.timestamp)}`,
        cover: h.coverImage ?? null,
        badge: h.duration > 0
          ? `${Math.round((h.timestamp / h.duration) * 100)}%`
          : undefined,
      }));
      list.push({
        id: "continue",
        label: `Continue Watching · ${continueItems.length}`,
        items: continueItems,
      });
    }

    // Bookmarks
    if (bookmarksLoaded && bookmarks.length > 0) {
      list.push({
        id: "bookmarks",
        label: `Bookmarks · ${Math.min(bookmarks.length, 5)}`,
        items: bookmarks.slice(0, 5).map((b) => ({
          id: `bookmark-${b.animeId}`,
          label: b.title,
          href: `/anime/${b.animeId}`,
          cover: b.coverImage ?? null,
        })),
      });
    }

    // Trending now
    if (trendingLoaded && trending.length > 0) {
      list.push({
        id: "trending",
        label: `Trending Now · ${Math.min(trending.length, 5)}`,
        items: trending.slice(0, 5).map((a) => ({
          id: `trending-${a.id}`,
          label:
            a.title.english ?? a.title.romaji ?? a.title.native ?? "Untitled",
          hint: a.seasonYear ? String(a.seasonYear) : undefined,
          href: `/anime/${a.id}`,
          cover: a.coverImage?.large ?? null,
          badge: a.averageScore ? `${a.averageScore}%` : undefined,
        })),
      });
    }

    // Page navigation (always last)
    list.push({
      id: "nav",
      label: `Pages · ${PAGE_NAV.length}`,
      items: PAGE_NAV,
    });

    return list;
  }, [
    query,
    searchResults,
    recentItems,
    recentLoaded,
    history,
    historyLoaded,
    bookmarks,
    bookmarksLoaded,
    trending,
    trendingLoaded,
  ]);

  // ─── Flat list of all items for keyboard nav ───
  const flatItems = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  // ─── Reset active index when groups change ───
  useEffect(() => {
    setActiveIndex(0);
  }, [groups]);

  // ─── Auto-scroll active item into view ───
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-cmd-idx="${activeIndex}"]`,
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  // ─── Keyboard nav inside the menu ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) {
        router.push(item.href);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  // ─── Click handler ───
  const handleSelect = (item: CommandItem) => {
    router.push(item.href);
    setOpen(false);
  };

  // ─── Render ───
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Command palette */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0c]/85 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 h-14 border-b border-white/8">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search anime, navigate pages…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/70"
              />
              {isSearching && (
                <div className="h-3 w-3 rounded-full border-2 border-xan-crimson/40 border-t-xan-crimson animate-spin" />
              )}
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results list */}
            <div
              ref={listRef}
              className="max-h-[60vh] overflow-y-auto xan-scroll p-2"
            >
              {flatItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {query.trim()
                    ? isSearching
                      ? "Searching…"
                      : "No results found."
                    : "Start typing to search."}
                </div>
              ) : (
                groups.map((group) => {
                  // Find flat indices for items in this group
                  let runningIdx = 0;
                  for (const g of groups) {
                    if (g.id === group.id) break;
                    runningIdx += g.items.length;
                  }
                  return (
                    <div key={group.id} className="mb-2 last:mb-0">
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item, i) => {
                          const flatIdx = runningIdx + i;
                          const isActive = flatIdx === activeIndex;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              data-cmd-idx={flatIdx}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              className={cn(
                                "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors",
                                isActive
                                  ? "bg-xan-crimson/15 text-foreground"
                                  : "text-foreground/90 hover:bg-white/[0.04]",
                              )}
                            >
                              {/* Cover thumbnail or icon */}
                              {item.cover ? (
                                <div className="relative w-8 h-10 rounded overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                                  <Image
                                    src={item.cover}
                                    alt={item.label}
                                    fill
                                    sizes="32px"
                                    className="object-cover"
                                  />
                                </div>
                              ) : Icon ? (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.06] flex-shrink-0">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.06] flex-shrink-0">
                                  <Play className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium line-clamp-1">
                                  {item.label}
                                </p>
                                {item.hint && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    {item.hint}
                                  </p>
                                )}
                              </div>

                              {item.badge && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                                  {item.badge}
                                </span>
                              )}

                              {isActive && (
                                <CornerDownLeft className="h-3.5 w-3.5 text-xan-crimson flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 h-9 border-t border-white/8 bg-white/[0.02] text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">esc</kbd>
                close
              </span>
              <span className="ml-auto flex items-center gap-1 text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                Powered by AniList
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── CommandMenuMount: just renders the menu (used in root layout) ───
export function CommandMenuMount() {
  return <CommandMenu />;
}

// ─── Fetch trending (server-side data already cached, but client uses /api/search) ───
async function fetchTrending(): Promise<Anime[]> {
  try {
    // Use the search API with empty query — sorts by trending isn't supported
    // via /api/search without `sort`, so we add it.
    const res = await fetch("/api/search?q=&perPage=5&sort=TRENDING_DESC");
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}
