// components/anime/RelatedAnime.tsx
// Server Component
// ✅ Relations: premium glass cards with cover images + role labels, hover lift.
// ✅ Recommendations: posters with hover glow + image zoom, titles → crimson on hover.

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { type RelationEdge, type Recommendation } from "@/types/anime";

interface RelatedAnimeProps {
  relations: RelationEdge[];
  recommendations: Recommendation[];
}

export function RelatedAnime({ relations, recommendations }: RelatedAnimeProps) {
  const validRelations = relations
    .filter((e) => e.relationType && e.relationType !== "CHARACTER")
    .slice(0, 8);

  const validRecs = recommendations
    .map((r) => r.mediaRecommendation)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 8);

  if (validRelations.length === 0 && validRecs.length === 0) return null;

  return (
    <section className="space-y-8">
      {/* ─── Relations ─── */}
      {validRelations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
            <h2 className="text-lg font-semibold font-display text-foreground">
              Relations
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {validRelations.length} titles
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {validRelations.map((edge) => {
              const title =
                edge.node.title.english ?? edge.node.title.romaji ?? "Untitled";
              const image = edge.node.coverImage.large || "/placeholder-card.png";
              return (
                <Link
                  key={edge.node.id}
                  href={`/anime/${edge.node.id}`}
                  className="group relative flex gap-3 p-3 rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-xan-crimson/40 hover:bg-white/[0.07] hover:shadow-[0_8px_30px_rgba(233,69,96,0.12)]"
                >
                  {/* Cover image */}
                  <div className="relative w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                    <Image
                      src={image}
                      alt={title}
                      fill
                      sizes="48px"
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-xan-crimson mb-1 font-semibold">
                      {edge.relationType}
                    </p>
                    <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-xan-crimson transition-colors leading-snug">
                      {title}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-xan-crimson transition-all absolute top-2 right-2" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Recommendations ─── */}
      {validRecs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
            <h2 className="text-lg font-semibold font-display text-foreground">
              Recommendations
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {validRecs.length} titles
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {validRecs.map((rec) => {
              const title =
                rec.title.english ?? rec.title.romaji ?? "Untitled";
              const image = rec.coverImage.large || "/placeholder-card.png";
              return (
                <Link
                  key={rec.id}
                  href={`/anime/${rec.id}`}
                  className="group space-y-2"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/8 bg-white/[0.04] transition-all duration-300 group-hover:border-xan-crimson/40 group-hover:shadow-[0_12px_40px_rgba(233,69,96,0.18)]">
                    <Image
                      src={image}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 50vw, 200px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {/* Hover glow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-xan-crimson/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* Score badge */}
                    {rec.averageScore != null && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-white">
                        {rec.averageScore}%
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-xan-crimson transition-colors leading-snug">
                    {title}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
