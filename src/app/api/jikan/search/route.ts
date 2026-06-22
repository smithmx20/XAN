// app/api/jikan/search/route.ts
import { NextResponse } from "next/server";
import { fetchJikanSearch } from "@/lib/jikan";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(Number(searchParams.get("limit") || "24"), 25);

  if (!q.trim()) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 },
    );
  }

  const result = await fetchJikanSearch(q, page, limit);
  if (!result) {
    return NextResponse.json(
      { error: "Failed to fetch from Jikan" },
      { status: 502 },
    );
  }
  return NextResponse.json(result);
}
