// components/allanime/AllAnimeCrossReference.tsx
// Server Component — shows AllAnime metadata alongside AniList on the detail page.
// Provides episode counts (sub/dub/raw), AllAnime score, and a link to AllAnime.
// ✅ Technical/dev info (AniList ID, MAL ID, raw score) hidden behind a
//    client-side toggle so casual users don't see it.

import { findShowByAniListId } from "@/lib/allanime";
import Link from "next/link";
import { ExternalLink, Tv, Film, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DevInfoToggle } from "./DevInfoToggle";

interface AllAnimeCrossReferenceProps {
  anilistId: number;
  anilistTitle: string;
}

export async function AllAnimeCrossReference({
  anilistId,
  anilistTitle,
}: AllAnimeCrossReferenceProps) {
  const show = await findShowByAniListId(anilistId, anilistTitle);

  if (!show) {
    return null;
  }

  const sub = show.availableEpisodes?.sub ?? 0;
  const dub = show.availableEpisodes?.dub ?? 0;
  const raw = show.availableEpisodes?.raw ?? 0;
  const hasStreams = sub > 0 || dub > 0 || raw > 0;

  return (
    <section className="rounded-lg border border-xan-border bg-xan-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
            AA
          </span>
          AllAnime Cross-Reference
        </h3>
        {hasStreams && (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Streamable
          </Badge>
        )}
      </div>

      {/* Episode availability */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-xan-card p-2 text-center">
          <div className="text-xs text-muted-foreground">SUB</div>
          <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
            {sub > 0 ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {sub}
              </>
            ) : (
              <XCircle className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="rounded-md bg-xan-card p-2 text-center">
          <div className="text-xs text-muted-foreground">DUB</div>
          <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
            {dub > 0 ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {dub}
              </>
            ) : (
              <XCircle className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="rounded-md bg-xan-card p-2 text-center">
          <div className="text-xs text-muted-foreground">RAW</div>
          <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
            {raw > 0 ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {raw}
              </>
            ) : (
              <XCircle className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Streaming note + link */}
      <div className="space-y-2">
        {hasStreams ? (
          <p className="text-xs text-emerald-500 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
            Streamable on AllAnime (via watch page)
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No streams available on AllAnime
          </p>
        )}
        <Link
          href={`https://allmanga.to/anime/${show._id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          View on AllAnime
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Dev info — collapsed by default */}
      <DevInfoToggle
        type={show.type}
        countryOfOrigin={show.countryOfOrigin}
        aniListId={show.aniListId}
        malId={show.malId}
        score={show.score}
      />
    </section>
  );
}

