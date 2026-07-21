import { NextResponse } from "next/server";
import { requireAdminSecret } from "app/lib/adminAuth";
import { hasDatabaseUrl } from "app/lib/db";
import { reviewExerciseMedia } from "app/lib/exerciseMedia";

export async function POST(request, { params }) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL not configured." }, { status: 503 });
  }

  const id = String(params?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Media id required." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const action = String(body?.action ?? "").trim().toLowerCase();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, message: "action must be approve or reject." }, { status: 400 });
  }

  try {
    const row = await reviewExerciseMedia({
      id,
      action,
      isPrimary: body?.isPrimary !== false,
      reviewedBy: body?.reviewedBy ?? "admin",
    });
    return NextResponse.json({ ok: true, data: { media: row } });
  } catch (e) {
    const message = e?.message ?? "Unable to review media.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
