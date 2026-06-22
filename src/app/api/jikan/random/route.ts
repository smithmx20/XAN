// app/api/jikan/random/route.ts
import { NextResponse } from "next/server";
import { fetchJikanRandom } from "@/lib/jikan";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchJikanRandom();
  if (!result) {
    return NextResponse.json(
      { error: "Failed to fetch from Jikan" },
      { status: 502 },
    );
  }
  return NextResponse.json({ data: result });
}
