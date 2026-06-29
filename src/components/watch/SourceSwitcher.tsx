"use client";

// components/watch/SourceSwitcher.tsx
// ✅ Always-visible, clickable sources panel — inspired by xancld.xyz
// ✅ Shows source name + type badge (mp4/hls/iframe) + bandwidth-tier preview
// ✅ Click any source to instantly switch (preserves playback position)
// ✅ Failed sources show a red ❌ indicator
// ✅ Active source highlighted with crimson border
// ✅ Tier preview badges predict which tier each source would use:
//       🟢 DIRECT  — no headers needed, browser loads direct
//       🟢 DIRECT+ — HLS with headers, manifest-proxy will be used (~5KB)
//       ☁️ CF      — CF Worker will handle it (0 Vercel BW)
//       🟡 PROXIED — full-proxy fallback (uses Vercel BW)

import { ListVideo, Zap, Cloud, Shield, AlertCircle, Check, Star } from "lucide-react";

export interface SourceItem {
  url: string;
  type: "hls" | "mp4" | "dash" | "iframe";
  quality: string | null;
  headers?: Record<string, string>;
  sourceName?: string;
  provider?: string;
}

interface SourceSwitcherProps {
  sources: SourceItem[];
  currentSourceIdx: number;
  failedSourceIdxs: Set<number>;
  onSelectSource: (idx: number) => void;
  /** Index of the recommended (most bandwidth-friendly) source — shows ⭐ badge */
  recommendedIdx?: number;
  className?: string;
}

// ✅ CF Worker URL — read once at module load (same pattern as YouTubeStylePlayer)
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? "";

/**
 * Predict which bandwidth tier a source would land on, based on its type
 * and whether it needs headers. This is a PREVIEW — the actual tier is only
 * known after playback starts (the player may auto-fallback).
 */
function predictTier(
  source: SourceItem,
): "direct" | "manifest-proxy" | "cf-proxy" | "full-proxy" {
  const hasHeaders = source.headers && Object.keys(source.headers).length > 0;

  // iframe sources load direct — no headers, no proxy
  if (source.type === "iframe") return "direct";

  // No headers → direct always works
  if (!hasHeaders) return "direct";

  // HLS with headers → manifest-proxy tier (server fetches .m3u8, segments direct)
  if (source.type === "hls") return "manifest-proxy";

  // MP4/DASH with headers:
  //   - If CF Worker is configured → cf-proxy (0 Vercel BW)
  //   - Else → full-proxy (uses Vercel BW)
  if (CF_WORKER_URL) return "cf-proxy";
  return "full-proxy";
}

/**
 * Score a source by bandwidth-friendliness (higher = better).
 * Used to pick the "Recommended" source on first load.
 *
 * Ranking rationale:
 *   1. no-headers DIRECT (100) — 0 Vercel BW, keeps custom player UI
 *   2. CF Worker (95)          — 0 Vercel BW, keeps custom UI, depends on CF
 *   3. iframe DIRECT (90)      — 0 Vercel BW, but loses custom UI (iframe)
 *   4. manifest-proxy (80)     — ~5KB Vercel BW (HLS only), keeps custom UI
 *   5. full-proxy (10)         — full Vercel BW, last resort
 */
export function scoreSource(source: SourceItem): number {
  const tier = predictTier(source);
  const hasHeaders = source.headers && Object.keys(source.headers).length > 0;

  if (tier === "direct") {
    // Distinguish iframe (loses custom UI) from no-headers direct (keeps UI)
    if (source.type === "iframe") return 90;
    if (!hasHeaders) return 100;
    return 100;
  }
  if (tier === "cf-proxy") return 95;
  if (tier === "manifest-proxy") return 80;
  return 10; // full-proxy
}

/**
 * Find the index of the most bandwidth-friendly source.
 * Returns -1 if the array is empty.
 * Ties are broken by lower index (first occurrence wins).
 */
export function findRecommendedSourceIdx(sources: SourceItem[]): number {
  if (sources.length === 0) return -1;
  let bestIdx = 0;
  let bestScore = scoreSource(sources[0]);
  for (let i = 1; i < sources.length; i++) {
    const score = scoreSource(sources[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function TierPreviewBadge({ tier }: { tier: ReturnType<typeof predictTier> }) {
  if (tier === "direct") {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wider px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-400/20"
        title="Direct — 0 server bandwidth"
      >
        <Zap className="h-2 w-2" />
        DIRECT
      </span>
    );
  }
  if (tier === "manifest-proxy") {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wider px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400/80 border border-emerald-400/15"
        title="Manifest proxy — ~5KB server bandwidth (HLS only)"
      >
        <Zap className="h-2 w-2" />
        DIRECT+
      </span>
    );
  }
  if (tier === "cf-proxy") {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wider px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-400/20"
        title="Cloudflare Worker — 0 Vercel bandwidth"
      >
        <Cloud className="h-2 w-2" />
        CF
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wider px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-400/20"
      title="Full proxy — uses Vercel bandwidth"
    >
      <Shield className="h-2 w-2" />
      PROXIED
    </span>
  );
}

function TypeBadge({ type }: { type: SourceItem["type"] }) {
  const config: Record<
    SourceItem["type"],
    { label: string; className: string }
  > = {
    mp4: {
      label: "MP4",
      className: "bg-green-500/20 text-green-400",
    },
    hls: {
      label: "HLS",
      className: "bg-blue-500/20 text-blue-400",
    },
    iframe: {
      label: "IFRAME",
      className: "bg-purple-500/20 text-purple-400",
    },
    dash: {
      label: "DASH",
      className: "bg-orange-500/20 text-orange-400",
    },
  };
  const c = config[type] ?? {
    label: type.toUpperCase(),
    className: "bg-zinc-500/20 text-zinc-400",
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${c.className}`}
    >
      {c.label}
    </span>
  );
}

export function SourceSwitcher({
  sources,
  currentSourceIdx,
  failedSourceIdxs,
  onSelectSource,
  recommendedIdx,
  className = "",
}: SourceSwitcherProps) {
  if (sources.length === 0) return null;

  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <ListVideo className="h-4 w-4 text-xan-crimson" />
        Sources
        <span className="text-xs text-muted-foreground font-normal">
          ({sources.length})
        </span>
      </h3>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
        {sources.map((source, idx) => {
          const isActive = idx === currentSourceIdx;
          const isFailed = failedSourceIdxs.has(idx);
          const isRecommended = idx === recommendedIdx && !isFailed;
          return (
            <button
              key={`${idx}-${source.url.slice(0, 40)}`}
              onClick={() => onSelectSource(idx)}
              disabled={isFailed && !isActive}
              className={`block w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                isActive
                  ? "bg-xan-crimson/15 text-foreground border border-xan-crimson/40"
                  : isFailed
                    ? "hover:bg-red-500/5 text-muted-foreground/50 border border-transparent cursor-not-allowed"
                    : isRecommended
                      ? "hover:bg-xan-card-hover text-foreground border border-emerald-400/30 bg-emerald-500/5"
                      : "hover:bg-xan-card-hover text-muted-foreground border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Status icon: ✓ active / ❌ failed / ⭐ recommended / nothing for normal */}
                  {isActive ? (
                    <Check className="h-3 w-3 text-xan-crimson flex-shrink-0" />
                  ) : isFailed ? (
                    <AlertCircle className="h-3 w-3 text-red-400/60 flex-shrink-0" />
                  ) : isRecommended ? (
                    <Star className="h-3 w-3 text-emerald-400 fill-emerald-400 flex-shrink-0" />
                  ) : null}
                  <span className="font-mono font-medium truncate">
                    {source.sourceName ?? `Source ${idx + 1}`}
                  </span>
                  {/* "Recommended" pill badge — only on the recommended source, not when active */}
                  {isRecommended && !isActive && (
                    <span className="text-[8px] font-bold tracking-wider px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-400/20 flex-shrink-0">
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <TierPreviewBadge tier={predictTier(source)} />
                  <TypeBadge type={source.type} />
                </div>
              </div>
              {/* Show failed reason if applicable */}
              {isFailed && !isActive && (
                <p className="text-[10px] text-red-400/60 mt-1 ml-5">
                  Failed all bandwidth tiers
                </p>
              )}
            </button>
          );
        })}
      </div>
      {/* Summary footer */}
      <div className="mt-3 pt-2 border-t border-xan-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {failedSourceIdxs.size > 0
            ? `${failedSourceIdxs.size} failed`
            : "Click any source to switch"}
        </span>
        <span>
          {sources.filter((s) => predictTier(s) === "direct" || predictTier(s) === "manifest-proxy" || predictTier(s) === "cf-proxy").length} bandwidth-friendly
        </span>
      </div>
    </div>
  );
}
