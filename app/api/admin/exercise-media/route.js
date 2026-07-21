import { NextResponse } from "next/server";
import { requireAdminSecret } from "app/lib/adminAuth";
import { hasDatabaseUrl } from "app/lib/db";
import { getExerciseById } from "app/lib/exerciseCatalog";
import { listExerciseMediaAdmin, submitExerciseMedia } from "app/lib/exerciseMedia";

export async function GET(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: { source: "mock", items: [], note: "DATABASE_URL not configured." },
    });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending_review";
  const limit = searchParams.get("limit") ?? "50";

  try {
    const data = await listExerciseMediaAdmin({ status, limit });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e?.message ?? "Unable to list exercise media. Did you run migration 001_exercise_media.sql?",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

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

  const autoApprove = body?.autoApprove === true;
  try {
    const row = await submitExerciseMedia({
      exerciseId,
      youtubeUrlOrId: body?.youtubeUrlOrId ?? body?.youtubeVideoId ?? body?.youtubeUrl ?? "",
      imageUrl: body?.imageUrl ?? "",
      title: body?.title ?? exercise.name ?? "",
      channelName: body?.channelName ?? "",
      imageAttribution: body?.imageAttribution ?? "",
      submittedBy: body?.submittedBy ?? "admin",
      status: autoApprove ? "approved" : "pending_review",
      isPrimary: Boolean(body?.isPrimary) && autoApprove,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          media: row,
          note: autoApprove ? "Inserted as approved." : "Inserted as pending_review.",
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Unable to submit media." }, { status: 400 });
  }
}
