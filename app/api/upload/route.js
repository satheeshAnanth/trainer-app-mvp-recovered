import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { readTrainerPhone } from "app/lib/session";
import { cookies } from "next/headers";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]);

export async function POST(request) {
  const cookieStore = cookies();
  const trainerPhone = readTrainerPhone(cookieStore.get("trainer_session")?.value);
  if (!trainerPhone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, message: "No file provided." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "File exceeds 10 MB limit." }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, message: "Only JPEG, PNG, WebP, GIF images and MP4 videos are accepted." }, { status: 415 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Dev fallback — return a placeholder so the UI doesn't break during development
    return NextResponse.json({
      ok: true,
      url: `https://placeholder-blob.dev/${Date.now()}-${encodeURIComponent(file.name ?? "upload")}`,
      source: "mock",
    });
  }

  const ext = (file.name ?? "").split(".").pop() || "bin";
  const pathname = `sessions/${trainerPhone.replace(/\D/g, "")}/${Date.now()}.${ext}`;
  const blob = await put(pathname, file, { access: "public" });

  return NextResponse.json({ ok: true, url: blob.url });
}
