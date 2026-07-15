// components/anime/CharacterList.tsx
// Server Component
// ✅ Premium glass cards with hover lift, avatar rings, role labels, VA section.
// ✅ Cards are clickable → link to /character/[id].

import Image from "next/image";
import Link from "next/link";
import { Mic, ArrowUpRight } from "lucide-react";
import type { CharacterEdge } from "@/types/anime";

interface CharacterListProps {
  characters: CharacterEdge[];
}

export function CharacterList({ characters }: CharacterListProps) {
  if (characters.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Premium section title with accent line */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
        <h2 className="text-lg font-semibold font-display text-foreground">
          Characters & Voice Actors
        </h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {characters.length} shown
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {characters.map((edge) => {
          const name = edge.node.name.full ?? "Unknown";
          const image =
            edge.node.image?.medium || "/placeholder-card.png";
          const role = edge.role ?? "—";
          const va = edge.voiceActors?.[0] ?? null;
          const vaName = va?.name?.full ?? null;
          const vaImage = va?.image?.large || "/placeholder-card.png";

          return (
            <Link
              key={edge.node.id}
              href={`/character/${edge.node.id}`}
              className="group relative block rounded-2xl overflow-hidden border border-white/8 bg-white/[0.04] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-xan-crimson/40 hover:bg-white/[0.07] hover:shadow-[0_8px_30px_rgba(233,69,96,0.12)]"
            >
              {/* Top-row: character + VA */}
              <div className="flex items-stretch">
                {/* Character (left) */}
                <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
                  {/* Avatar with hover ring */}
                  <div className="relative w-12 h-12 rounded-full flex-shrink-0 ring-2 ring-white/10 ring-offset-2 ring-offset-transparent group-hover:ring-xan-crimson/60 transition-all duration-300">
                    <div className="absolute inset-0 rounded-full overflow-hidden bg-xan-card-hover">
                      <Image
                        src={image}
                        alt={name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-xan-crimson transition-colors">
                      {name}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5 font-medium">
                      {role}
                    </p>
                  </div>
                </div>

                {/* Voice Actor (right) — only if VA data exists */}
                {va && vaName && (
                  <>
                    <div className="w-px bg-white/8" />
                    <div className="flex items-center gap-2 p-3 flex-1 min-w-0 bg-white/[0.02]">
                      <div className="relative w-10 h-10 rounded-full flex-shrink-0 ring-1 ring-white/10 overflow-hidden bg-xan-card-hover">
                        <Image
                          src={vaImage}
                          alt={vaName}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground line-clamp-1">
                          {vaName}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 line-clamp-1 mt-0.5">
                          <Mic className="h-2.5 w-2.5" />
                          {va.language ?? "JP"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Hover affordance: arrow */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-6 h-6 rounded-full bg-xan-crimson/15 border border-xan-crimson/30 flex items-center justify-center">
                  <ArrowUpRight className="h-3 w-3 text-xan-crimson" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
