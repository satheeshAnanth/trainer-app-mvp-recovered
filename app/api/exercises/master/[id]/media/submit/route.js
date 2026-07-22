import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "app/lib/db";
import { getExerciseById } from "app/lib/exerciseCatalog";
import { submitExerciseMedia } from "app/lib/exerciseMedia";
import { readTrainerPhone } from "app/lib/session";

export async function POST(request) {
  const trainerPhone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!trainerPhone) {
    return NextResponse.json({ ok: false, message: "Trainer login required." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const exerciseId = String(body?.exerciseId ?? "").trim();
  if (!exerciseId) {
    return NextResponse.json({ ok: false, message: "exerciseId is required." }, { status: 400 });
  }

  const exercise = await getExerciseById(exerciseId);
  if (!exercise) {
    return NextResponse.json({ ok: false, message: "Exercise not found." }, { status: 404 });
  }

  try {
    const row = await submitExerciseMedia({
      exerciseId,
      youtubeUrlOrId: body?.youtubeUrlOrId ?? body?.youtubeVideoId ?? body?.youtubeUrl ?? "",
      title: body?.title ?? exercise.name ?? "",
      channelName: body?.channelName ?? "",
      submittedBy: `trainer:${trainerPhone}`,
      status: "pending_review",
      isPrimary: false,
    });

    return NextResponse.json({
      ok: true,
      data: {
        media: row,
        note: "Submitted for admin review. It will appear after approval.",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Unable to submit media." }, { status: 400 });
  }
}
