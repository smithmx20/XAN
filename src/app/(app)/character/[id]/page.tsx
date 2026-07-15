// app/(app)/character/[id]/page.tsx
// Server Component (async)
// ✅ Premium glass info card with character image, name, native name
// ✅ Alternative names display
// ✅ Quick info pills (age, gender, date of birth)
// ✅ Character description
// ✅ Anime appearances grid — cover images with role labels, season year, hover effects
// ✅ generateMetadata for SEO
// ✅ Back button

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Calendar, User, Cake, Droplet, ExternalLink } from "lucide-react";
import { fetchCharacter } from "@/lib/anilist";
import {
  sanitizeDescription,
  formatFuzzyDate,
  type CharacterDetail,
} from "@/types/anime";
import { ErrorCard } from "@/components/ErrorCard";
import { BackButton } from "@/components/layout/BackButton";

export const revalidate = 3600; // 1 hour

type Props = {
  params: Promise<{ id: string }>;
};

// ✅ generateMetadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const charId = parseInt(id, 10);
  if (isNaN(charId)) return { title: "Character Not Found" };

  const result = await fetchCharacter(charId);
  if (!result?.data) return { title: "Character Not Found" };

  const c = result.data;
  const name = c.name.full ?? c.name.native ?? "Unknown";

  return {
    title: `${name} — Character`,
    description:
      sanitizeDescription(c.description).slice(0, 160) ||
      `View ${name}'s anime appearances on XAN.`,
    openGraph: {
      title: `${name} | XAN Characters`,
      description:
        sanitizeDescription(c.description).slice(0, 160) ||
        `View ${name}'s anime appearances on XAN.`,
      images: c.image?.large ? [{ url: c.image.large }] : undefined,
    },
  };
}

export default async function CharacterDetailPage({ params }: Props) {
  const { id } = await params;
  const charId = parseInt(id, 10);

  if (isNaN(charId)) {
    notFound();
  }

  const result = await fetchCharacter(charId);

  if (!result?.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <ErrorCard message="This character could not be loaded." />
      </div>
    );
  }

  const c: CharacterDetail = result.data;
  const name = c.name.full ?? c.name.native ?? "Unknown";
  const nativeName = c.name.native;
  const alternativeNames = c.name.alternative.filter(Boolean);
  const image = c.image?.large ?? c.image?.medium ?? "/placeholder-card.png";
  const description = sanitizeDescription(c.description);
  const appearances = c.media?.edges ?? [];

  return (
    <div className="pb-12 space-y-8 pt-6">
      {/* ─── Back button ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <BackButton />
      </div>

      {/* ─── Premium glass info card ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="relative rounded-3xl overflow-hidden border border-white/8 bg-white/[0.04] backdrop-blur-xl">
          {/* Ambient backdrop using character image */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <Image
              src={image}
              alt=""
              fill
              sizes="100vw"
              className="object-cover blur-3xl scale-110"
            />
          </div>

          <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Character image */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="relative w-40 h-56 md:w-48 md:h-64 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
                <Image
                  src={image}
                  alt={name}
                  fill
                  priority
                  sizes="(max-width: 768px) 160px, 192px"
                  className="object-cover"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h1 className="text-2xl md:text-4xl font-display font-extrabold text-foreground leading-tight">
                  {name}
                </h1>
                {nativeName && nativeName !== name && (
                  <p className="text-sm md:text-base text-muted-foreground italic mt-1">
                    {nativeName}
                  </p>
                )}
              </div>

              {/* Alternative names */}
              {alternativeNames.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {alternativeNames.slice(0, 6).map((alt) => (
                    <span
                      key={alt}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/8 text-muted-foreground"
                    >
                      {alt}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick info pills */}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {c.age && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/8 text-xs text-foreground">
                    <User className="h-3 w-3 text-xan-crimson" />
                    Age: {c.age}
                  </div>
                )}
                {c.gender && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/8 text-xs text-foreground">
                    <User className="h-3 w-3 text-xan-violet" />
                    {c.gender}
                  </div>
                )}
                {(c.dateOfBirth?.year || c.dateOfBirth?.month || c.dateOfBirth?.day) && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/8 text-xs text-foreground">
                    <Cake className="h-3 w-3 text-xan-crimson" />
                    {formatFuzzyDate(c.dateOfBirth)}
                  </div>
                )}
                {c.bloodType && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/8 text-xs text-foreground">
                    <Droplet className="h-3 w-3 text-xan-crimson" />
                    {c.bloodType}
                  </div>
                )}
              </div>

              {/* Description */}
              {description && (
                <div className="pt-2">
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-6 md:line-clamp-none max-w-3xl mx-auto md:mx-0">
                    {description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Anime appearances ─── */}
      {appearances.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
            <h2 className="text-lg font-semibold font-display text-foreground">
              Anime Appearances
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {appearances.length} titles
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {appearances.map((edge) => {
              const title =
                edge.node.title.english ??
                edge.node.title.romaji ??
                "Untitled";
              const cover = edge.node.coverImage?.large ?? "/placeholder-card.png";
              const color = edge.node.coverImage?.color ?? "#e94560";
              return (
                <Link
                  key={edge.node.id}
                  href={`/anime/${edge.node.id}`}
                  className="group space-y-2"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/8 bg-white/[0.04] transition-all duration-300 group-hover:border-xan-crimson/40 group-hover:shadow-[0_12px_40px_rgba(233,69,96,0.18)]">
                    <Image
                      src={cover}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 50vw, 200px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-xan-crimson/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* Role label */}
                    {edge.characterRole && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-[10px] uppercase tracking-wider font-semibold text-xan-crimson border border-xan-crimson/30">
                        {edge.characterRole}
                      </div>
                    )}
                    {/* Score badge */}
                    {edge.node.averageScore != null && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-white">
                        {edge.node.averageScore}%
                      </div>
                    )}
                    {/* Bottom info: year + format */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      {edge.node.seasonYear && (
                        <p className="text-[10px] text-white/80 flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {edge.node.seasonYear}
                          {edge.node.format && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-white/40 mx-1" />
                              {edge.node.format}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    {/* Color accent line */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: color }}
                    />
                  </div>
                  <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-xan-crimson transition-colors leading-snug flex items-start gap-1">
                    <span className="flex-1">{title}</span>
                    <ExternalLink className="h-3 w-3 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
