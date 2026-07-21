import { NextResponse } from "next/server";
import { fetchApprovedMediaForExercise } from "app/lib/exerciseMedia";

export async function GET(_request, { params }) {
  const exerciseId = String(params?.id ?? "").trim();
  if (!exerciseId) {
    return NextResponse.json({ ok: false, message: "Exercise id required." }, { status: 400 });
  }

  const media = await fetchApprovedMediaForExercise(exerciseId);
  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/exercises/master/[id]/media",
    data: { exerciseId, media, source: media.length ? "database" : "empty" },
  });
  response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return response;
}
