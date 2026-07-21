import { NextResponse } from "next/server";
import { getScheduleViewer } from "app/lib/schedule";
import { registerDeviceToken } from "app/lib/pushNotifications";

export async function POST(request) {
  const viewer = getScheduleViewer(request);
  if (!viewer) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const token = String(body?.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, message: "token is required." }, { status: 400 });
  }

  const platform = String(body?.platform ?? "android").trim() || "android";
  const userRole = viewer.role;
  const userKey = viewer.role === "trainer" ? viewer.trainerPhone : viewer.clientId;

  try {
    await registerDeviceToken({ userRole, userKey, token, platform });
    return NextResponse.json({
      ok: true,
      data: { registered: true, userRole, platform },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e?.message ?? "Unable to register push token. Did you run migration 002_push_device_tokens.sql?",
      },
      { status: 500 }
    );
  }
}
