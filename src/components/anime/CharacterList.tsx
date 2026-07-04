// components/anime/CharacterList.tsx
// Server Component
// ✅ Shows character + their Japanese voice actor (if available)

import Image from "next/image";
import { Mic } from "lucide-react";
import type { CharacterEdge } from "@/types/anime";

interface CharacterListProps {
  characters: CharacterEdge[];
}

export function CharacterList({ characters }: CharacterListProps) {
  if (characters.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold font-display text-foreground">
        Characters & Voice Actors
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {characters.map((edge) => {
          const name = edge.node.name.full ?? "Unknown";
          const image = edge.node.image?.medium || "/placeholder-card.png";
          const role = edge.role ?? "—";
          const va = edge.voiceActors?.[0] ?? null;
          const vaName = va?.name?.full ?? null;
          const vaImage = va?.image?.large || "/placeholder-card.png";

          return (
            <div
              key={edge.node.id}
              className="flex items-stretch rounded-lg bg-xan-card border border-xan-border overflow-hidden hover:border-xan-crimson/30 transition-colors"
            >
              {/* Character (left) */}
              <div className="flex items-center gap-3 p-2 flex-1 min-w-0">
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-xan-card-hover">
                  <Image
                    src={image}
                    alt={name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {name}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {role}
                  </p>
                </div>
              </div>

              {/* Voice Actor (right) — only if VA data exists */}
              {va && vaName && (
                <>
                  <div className="w-px bg-xan-border" />
                  <div className="flex items-center gap-2 p-2 flex-1 min-w-0 bg-xan-card-hover/40">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-xan-card-hover">
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
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 line-clamp-1">
                        <Mic className="h-2.5 w-2.5" />
                        {va.language ?? "JP"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
