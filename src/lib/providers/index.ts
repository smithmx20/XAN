// lib/providers/index.ts
// ✅ Unified provider registry — lists all available stream providers
// ✅ Used by the SourceSwitcher to show provider names and by the priority system

export type ProviderId =
  | "allanime" // Our existing AllAnime extractor (Yt-mp4, Mp4, Sw, Ok, etc.)
  | "zen" // flixcloud.cc — HLS embed
  | "koto" // megaplay.buzz — iframe embed
  | "pahe"; // nekostream — MP4 downloads

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  description: string;
  /** Whether this provider supports sub streams */
  supportsSub: boolean;
  /** Whether this provider supports dub streams */
  supportsDub: boolean;
  /** Default priority (higher = tried first) */
  defaultPriority: number;
}

/**
 * Registry of all available providers.
 * Displayed in Settings → Bandwidth → Provider Priority.
 */
export const PROVIDERS: ProviderInfo[] = [
  {
    id: "allanime",
    name: "AllAnime",
    description: "Primary provider — extracts streams from AllAnime's API. Returns multiple sources per episode (Yt-mp4, Mp4, StreamWish, Ok.ru, etc.)",
    supportsSub: true,
    supportsDub: true,
    defaultPriority: 100,
  },
  {
    id: "zen",
    name: "Zen",
    description: "FlixCloud embed — HLS player. 0 Vercel bandwidth (iframe). Good fallback when AllAnime sources fail.",
    supportsSub: true,
    supportsDub: false,
    defaultPriority: 80,
  },
  {
    id: "koto",
    name: "Koto",
    description: "MegaPlay embed — iframe player. 0 Vercel bandwidth. Good for subbed anime.",
    supportsSub: true,
    supportsDub: true,
    defaultPriority: 70,
  },
  {
    id: "pahe",
    name: "AnimePahe",
    description: "AnimePahe downloads — direct MP4 URLs via nekostream mapper. Good quality, may need CF Worker.",
    supportsSub: true,
    supportsDub: false,
    defaultPriority: 60,
  },
];

/**
 * Get the default priority order for all providers.
 * Used to initialize the providerPriority setting.
 */
export function getDefaultProviderPriority(): ProviderId[] {
  return [...PROVIDERS].sort((a, b) => b.defaultPriority - a.defaultPriority).map((p) => p.id);
}

/**
 * Get provider info by ID.
 */
export function getProviderInfo(id: ProviderId): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
