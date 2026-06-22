// app/api/jikan/top/route.ts
import { NextResponse } from "next/server";
import { fetchJikanTop } from "@/lib/jikan";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const type = (searchParams.get("type") || undefined) as
    | "tv"
    | "movie"
    | "ova"
    | "special"
    | "ona"
    | "music"
    | undefined;

  const result = await fetchJikanTop(page, type);
  if (!result) {
    return NextResponse.json(
      { error: "Failed to fetch from Jikan" },
      { status: 502 },
    );
  }
  return NextResponse.json(result);
}
