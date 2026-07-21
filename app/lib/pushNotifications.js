import { createSign, randomUUID } from "crypto";
import { hasDatabaseUrl, query } from "./db";

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function parseServiceAccount() {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  const rawB64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "").trim();

  let text = rawJson;
  if (!text && rawB64) {
    try {
      text = Buffer.from(rawB64, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (!parsed?.client_email || !parsed?.private_key || !parsed?.project_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isPushConfigured() {
  return Boolean(parseServiceAccount());
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < cachedAccessTokenExpiresAt - 60) {
    return cachedAccessToken;
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(serviceAccount.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const assertion = `${unsigned}.${signature}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.access_token) {
    throw new Error(json?.error_description || json?.error || "Unable to obtain FCM access token");
  }

  cachedAccessToken = json.access_token;
  cachedAccessTokenExpiresAt = now + Number(json.expires_in || 3600);
  return cachedAccessToken;
}

export async function registerDeviceToken({ userRole, userKey, token, platform = "android" }) {
  if (!hasDatabaseUrl()) return { ok: false, reason: "no_database" };
  const role = String(userRole ?? "").trim();
  const key = String(userKey ?? "").trim();
  const deviceToken = String(token ?? "").trim();
  if (!role || !key || !deviceToken) {
    throw new Error("userRole, userKey, and token are required.");
  }

  const id = randomUUID();
  await query(
    `
      INSERT INTO push_device_tokens (id, user_role, user_key, token, platform, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (token) DO UPDATE SET
        user_role = EXCLUDED.user_role,
        user_key = EXCLUDED.user_key,
        platform = EXCLUDED.platform,
        updated_at = now(),
        last_seen_at = now()
    `,
    [id, role, key, deviceToken, platform]
  );

  return { ok: true };
}

export async function fetchTokensForUser(userRole, userKey) {
  if (!hasDatabaseUrl() || !userRole || !userKey) return [];
  try {
    const rows = await query(
      `
        SELECT token
        FROM push_device_tokens
        WHERE user_role = $1 AND user_key = $2
        ORDER BY last_seen_at DESC
        LIMIT 20
      `,
      [userRole, userKey]
    );
    return rows.map((row) => row.token).filter(Boolean);
  } catch {
    return [];
  }
}

async function sendFcmHttpV1(token, { title, body, data = {} }) {
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    return { ok: false, skipped: true, reason: "FIREBASE_SERVICE_ACCOUNT_JSON not configured" };
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(serviceAccount);
  } catch (e) {
    return { ok: false, message: e?.message ?? "oauth_failed" };
  }

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: String(title ?? "Trainer App"),
            body: String(body ?? ""),
          },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")])),
          android: {
            priority: "HIGH",
          },
        },
      }),
    }
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: json?.error?.message ?? JSON.stringify(json),
    };
  }
  return { ok: true, name: json?.name ?? null };
}

export async function sendPushToUser({ userRole, userKey, title, body, data = {} }) {
  const tokens = await fetchTokensForUser(userRole, userKey);
  if (tokens.length === 0) {
    return { ok: true, sent: 0, skipped: true, reason: "no_tokens" };
  }

  if (!isPushConfigured()) {
    return { ok: true, sent: 0, skipped: true, reason: "fcm_not_configured" };
  }

  let successCount = 0;
  let lastError = "";
  for (const token of tokens) {
    const result = await sendFcmHttpV1(token, { title, body, data });
    if (result.ok) successCount += 1;
    else lastError = result.message ?? result.reason ?? "send_failed";
  }

  if (hasDatabaseUrl()) {
    try {
      await query(
        `
          INSERT INTO push_notification_log (
            id, user_role, user_key, title, body, data_json, token_count, success_count, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
        `,
        [
          randomUUID(),
          userRole,
          userKey,
          title,
          body,
          JSON.stringify(data),
          tokens.length,
          successCount,
          successCount > 0 ? null : lastError || null,
        ]
      );
    } catch {
      // logging is best-effort
    }
  }

  return { ok: successCount > 0, sent: successCount, tokenCount: tokens.length, error: lastError || null };
}

export async function notifyScheduleStatusChange(event, actorRole, newStatus) {
  if (!event) return { ok: false, reason: "no_event" };

  const date = event.scheduled_date ?? "";
  const time = event.scheduled_time ?? "";
  const clientName = event.client_name ?? "Client";
  const statusLabel = String(newStatus ?? "").replace(/_/g, " ");

  if (actorRole === "trainer") {
    const title = "Schedule update";
    const bodyText = `Your trainer ${statusLabel} the appointment on ${date}${time ? ` at ${time}` : ""}.`;
    return sendPushToUser({
      userRole: "client",
      userKey: String(event.client_id ?? ""),
      title,
      body: bodyText,
      data: { type: "schedule_status", eventId: String(event.id ?? ""), status: newStatus },
    });
  }

  if (actorRole === "client") {
    const title = "Schedule update";
    const bodyText = `${clientName} ${statusLabel} the appointment on ${date}${time ? ` at ${time}` : ""}.`;
    return sendPushToUser({
      userRole: "trainer",
      userKey: String(event.trainer_phone ?? ""),
      title,
      body: bodyText,
      data: { type: "schedule_status", eventId: String(event.id ?? ""), status: newStatus },
    });
  }

  return { ok: false, reason: "unknown_actor" };
}

async function resolveTrainerPhoneForClient(clientId) {
  if (!hasDatabaseUrl() || !clientId) return null;
  try {
    const rows = await query(
      `SELECT created_by_trainer FROM clients WHERE id = $1 LIMIT 1`,
      [clientId]
    );
    return rows[0]?.created_by_trainer ?? null;
  } catch {
    return null;
  }
}

export async function notifyScheduleRequestCreated(event, actorRole) {
  if (!event || String(event.status ?? "") !== "pending") {
    return { ok: false, reason: "not_pending" };
  }

  const date = event.scheduled_date ?? "";
  const time = event.scheduled_time ?? "";
  const when = `${date}${time ? ` at ${time}` : ""}`;

  if (actorRole === "trainer") {
    return sendPushToUser({
      userRole: "client",
      userKey: String(event.client_id ?? ""),
      title: "New appointment request",
      body: `Your trainer requested an appointment${when ? ` on ${when}` : ""}.`,
      data: { type: "schedule_request", eventId: String(event.id ?? ""), status: "pending" },
    });
  }

  if (actorRole === "client") {
    const trainerPhone = event.trainer_phone ?? (await resolveTrainerPhoneForClient(event.client_id));
    if (!trainerPhone) return { ok: false, reason: "no_trainer_phone" };
    const clientName = event.client_name ?? "Your client";
    return sendPushToUser({
      userRole: "trainer",
      userKey: String(trainerPhone),
      title: "New appointment request",
      body: `${clientName} requested an appointment${when ? ` on ${when}` : ""}.`,
      data: { type: "schedule_request", eventId: String(event.id ?? ""), status: "pending" },
    });
  }

  return { ok: false, reason: "unknown_actor" };
}

export async function notifySessionPublished({ sessionId, clientId, sessionTitle }) {
  if (!clientId) return { ok: false, reason: "no_client" };
  const title = String(sessionTitle ?? "").trim();
  return sendPushToUser({
    userRole: "client",
    userKey: String(clientId),
    title: "Session details published",
    body: title
      ? `Your trainer published "${title}".`
      : "Your trainer published new session details for you to review.",
    data: { type: "session_published", sessionId: String(sessionId ?? "") },
  });
}

export async function notifyClientSelfLogSubmitted({ sessionId, clientId, clientName, sessionTitle }) {
  const trainerPhone = await resolveTrainerPhoneForClient(clientId);
  if (!trainerPhone) return { ok: false, reason: "no_trainer_phone" };

  const title = String(sessionTitle ?? "").trim();
  const who = String(clientName ?? "Your client").trim() || "Your client";
  return sendPushToUser({
    userRole: "trainer",
    userKey: String(trainerPhone),
    title: "Client self-log submitted",
    body: title ? `${who} submitted "${title}" for review.` : `${who} submitted a workout log for review.`,
    data: { type: "client_self_log", sessionId: String(sessionId ?? ""), clientId: String(clientId ?? "") },
  });
}
