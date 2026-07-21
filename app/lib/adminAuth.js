import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminToken, readAdminSession } from "app/lib/session";

const ADMIN_COOKIE = "admin_session";
const ADMIN_TTL_SECONDS = 7 * 24 * 60 * 60;

function safeEqualString(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getAdminCredentials() {
  const email = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD ?? "");
  return { email, password };
}

export function isAdminLoginConfigured() {
  const { email, password } = getAdminCredentials();
  return Boolean(email && password);
}

export function verifyAdminPassword(email, password) {
  const expected = getAdminCredentials();
  if (!expected.email || !expected.password) return false;
  const providedEmail = String(email ?? "").trim().toLowerCase();
  return safeEqualString(providedEmail, expected.email) && safeEqualString(password, expected.password);
}

/** Accepts X-Admin-Secret (scripts) or admin_session cookie (browser). */
export function requireAdminSecret(request) {
  const headerSecret = request.headers.get("x-admin-secret");
  const envSecret = process.env.ADMIN_SECRET;

  if (envSecret && headerSecret && safeEqualString(headerSecret, envSecret)) {
    return null;
  }

  const cookieToken = request.cookies.get(ADMIN_COOKIE)?.value;
  const session = readAdminSession(cookieToken);
  if (session?.role === "admin") {
    return null;
  }

  if (!envSecret && !isAdminLoginConfigured() && process.env.NODE_ENV !== "production") {
    return null;
  }

  return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  };
}

export function createAdminSessionCookie(email) {
  return {
    name: ADMIN_COOKIE,
    value: createAdminToken(email),
    options: adminCookieOptions(),
  };
}

export function clearAdminSessionCookie() {
  return {
    name: ADMIN_COOKIE,
    value: "",
    options: { ...adminCookieOptions(), maxAge: 0 },
  };
}

export function readAdminFromRequest(request) {
  return readAdminSession(request.cookies.get(ADMIN_COOKIE)?.value);
}
