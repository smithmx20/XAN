// app/api/jikan/season/route.ts
import { NextResponse } from "next/server";
import { fetchJikanSeasonNow } from "@/lib/jikan";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));

  const result = await fetchJikanSeasonNow(page);
  if (!result) {
    return NextResponse.json(
      { error: "Failed to fetch from Jikan" },
      { status: 502 },
    );
  }
  return NextResponse.json(result);
}
