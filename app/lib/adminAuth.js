import { NextResponse } from "next/server";

export function requireAdminSecret(request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // In dev without the env var set, allow through so local work isn't blocked
    if (process.env.NODE_ENV !== "production") return null;
    return NextResponse.json({ ok: false, message: "Admin access not configured." }, { status: 503 });
  }

  const provided = request.headers.get("x-admin-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  return null; // null = access granted, caller proceeds
}
