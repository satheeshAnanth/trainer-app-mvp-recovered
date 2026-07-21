import { NextResponse } from "next/server";
import { requireAdminSecret } from "app/lib/adminAuth";
import { isPushConfigured, sendPushToUser } from "app/lib/pushNotifications";

export async function POST(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const userRole = String(body?.userRole ?? "").trim();
  const userKey = String(body?.userKey ?? "").trim();
  const title = String(body?.title ?? "Trainer App").trim();
  const bodyText = String(body?.body ?? "").trim();

  if (!userRole || !userKey || !bodyText) {
    return NextResponse.json(
      { ok: false, message: "userRole, userKey, and body are required." },
      { status: 400 }
    );
  }

  const result = await sendPushToUser({
    userRole,
    userKey,
    title,
    body: bodyText,
    data: body?.data && typeof body.data === "object" ? body.data : {},
  });

  return NextResponse.json({
    ok: true,
    data: {
      ...result,
      fcmConfigured: isPushConfigured(),
    },
  });
}
