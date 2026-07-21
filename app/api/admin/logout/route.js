import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "app/lib/adminAuth";

export async function POST() {
  const cookie = clearAdminSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
