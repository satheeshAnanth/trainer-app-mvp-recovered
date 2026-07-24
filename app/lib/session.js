import { createHmac, timingSafeEqual } from "crypto";

// SESSION_SECRET must be set in production via env vars.
// In dev without it, a fallback is used so local work isn't blocked,
// but all dev sessions are invalidated whenever the server restarts.
function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET env var is required in production.");
  }
  return secret ?? "dev-insecure-fallback-secret-do-not-use-in-production";
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function sign(payload) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function verifyAndDecode(token, decoder) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  // Expect exactly 3 dot-separated base64url segments: data, expiry, signature
  if (parts.length !== 3) return null;

  const [dataB64, expStr, sig] = parts;
  const payload = `${dataB64}.${expStr}`;
  const expected = sign(payload);

  // Timing-safe comparison to prevent signature oracle attacks
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, sigBuf)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return null;

  try {
    return decoder(Buffer.from(dataB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ── Trainer session ──────────────────────────────────────────────────────────

export function createTrainerToken(phone) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const dataB64 = Buffer.from(phone, "utf8").toString("base64url");
  const payload = `${dataB64}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the trainer's phone string, or null if token is invalid/expired. */
export function readTrainerPhone(token) {
  return verifyAndDecode(token, (raw) => raw);
}

// ── Client session ───────────────────────────────────────────────────────────

export function createClientToken(clientId, phone) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const dataB64 = Buffer.from(JSON.stringify({ clientId, phone }), "utf8").toString("base64url");
  const payload = `${dataB64}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns { clientId, phone }, or null if token is invalid/expired. */
export function readClientSession(token) {
  return verifyAndDecode(token, (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.clientId) return null;
    return parsed;
  });
}

// ── Admin session ────────────────────────────────────────────────────────────

export function createAdminToken(email) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const dataB64 = Buffer.from(JSON.stringify({ role: "admin", email: String(email ?? "").toLowerCase() }), "utf8").toString("base64url");
  const payload = `${dataB64}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns { role: 'admin', email }, or null if token is invalid/expired. */
export function readAdminSession(token) {
  return verifyAndDecode(token, (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.role !== "admin" || !parsed.email) return null;
    return parsed;
  });
}

// ── Gym admin session ────────────────────────────────────────────────────────

export function createGymAdminToken(phone, gymId) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const dataB64 = Buffer.from(
    JSON.stringify({ role: "gym_admin", phone: String(phone ?? ""), gymId: String(gymId ?? "") }),
    "utf8"
  ).toString("base64url");
  const payload = `${dataB64}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns { role: 'gym_admin', phone, gymId }, or null if token is invalid/expired. */
export function readGymAdminSession(token) {
  return verifyAndDecode(token, (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.role !== "gym_admin" || !parsed.phone || !parsed.gymId) return null;
    return parsed;
  });
}
