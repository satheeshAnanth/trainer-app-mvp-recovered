import { NextResponse } from "next/server";
import {
  createAdminSessionCookie,
  isAdminLoginConfigured,
  verifyAdminPassword,
} from "app/lib/adminAuth";

export async function POST(request) {
  if (!isAdminLoginConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ ok: false, message: "Email and password are required." }, { status: 400 });
  }

  if (!verifyAdminPassword(email, password)) {
    return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 401 });
  }

  const cookie = createAdminSessionCookie(email);
  const response = NextResponse.json({
    ok: true,
    data: { email: email.toLowerCase(), role: "admin" },
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
