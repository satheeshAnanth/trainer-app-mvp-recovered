import { NextResponse } from "next/server";
import { requireAdminSecret, readAdminFromRequest } from "app/lib/adminAuth";

export function adminJson(data, init = {}) {
  return NextResponse.json({ ok: true, data }, init);
}

export function adminError(message, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

/** Returns { denied, actorEmail } — if denied is a Response, return it. */
export function requireAdmin(request) {
  const denied = requireAdminSecret(request);
  if (denied) return { denied, actorEmail: null };

  const method = String(request.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return { denied: adminError("Forbidden origin.", 403), actorEmail: null };
        }
      } catch {
        return { denied: adminError("Forbidden origin.", 403), actorEmail: null };
      }
    }
  }

  const session = readAdminFromRequest(request);
  const headerActor = request.headers.get("x-admin-actor");
  const actorEmail = session?.email || headerActor || "admin";
  return { denied: null, actorEmail };
}

export function parsePagination(searchParams, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(searchParams.get("limit") || defaultLimit) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}
