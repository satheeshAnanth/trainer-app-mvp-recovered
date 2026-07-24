import { NextResponse } from "next/server";
import { createGymAdminToken, readGymAdminSession } from "app/lib/session";
import { getGymAdminByPhone, normalizePhone } from "app/lib/gyms";

const GYM_COOKIE = "gym_session";
const GYM_TTL_SECONDS = 7 * 24 * 60 * 60;

export function gymCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GYM_TTL_SECONDS,
  };
}

export function createGymSessionCookie(phone, gymId) {
  return {
    name: GYM_COOKIE,
    value: createGymAdminToken(phone, gymId),
    options: gymCookieOptions(),
  };
}

export function clearGymSessionCookie() {
  return {
    name: GYM_COOKIE,
    value: "",
    options: { ...gymCookieOptions(), maxAge: 0 },
  };
}

export function readGymAdminFromRequest(request) {
  return readGymAdminSession(request.cookies.get(GYM_COOKIE)?.value);
}

/** Returns session or a NextResponse 401. */
export async function requireGymAdmin(request) {
  const session = readGymAdminFromRequest(request);
  if (!session?.phone || !session?.gymId) {
    return { error: NextResponse.json({ ok: false, message: "Gym login required." }, { status: 401 }) };
  }

  const admin = await getGymAdminByPhone(session.phone);
  if (!admin || admin.gym_id !== session.gymId) {
    return { error: NextResponse.json({ ok: false, message: "Gym admin access revoked." }, { status: 403 }) };
  }
  if (admin.gym_status !== "active") {
    return { error: NextResponse.json({ ok: false, message: "Gym is suspended." }, { status: 403 }) };
  }

  return {
    session: {
      phone: normalizePhone(session.phone),
      gymId: session.gymId,
      name: admin.name,
      role: admin.role,
      gymName: admin.gym_name,
    },
  };
}
