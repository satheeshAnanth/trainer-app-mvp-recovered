import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const trainerPhone = readTrainerPhone(request.cookies.get("trainer_session")?.value) ?? null;

  if (!hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/audit");
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/audit",
      data: {
        source: payload?.source ?? "mock",
        count: Array.isArray(payload?.records) ? payload.records.length : 0,
        limit,
        events: normalizeAuditRows(payload?.records ?? []),
      },
    });
  }

  if (!trainerPhone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const rows = await query(
    `
      SELECT id, entity_type, entity_id, payload_json, created_at
      FROM audit_events
      WHERE
        payload_json::jsonb->>'capturedBy' = $1
        OR payload_json::jsonb->>'actorId' = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [trainerPhone, limit]
  );

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/audit",
    data: {
      source: "database",
      count: rows.length,
      limit,
      events: normalizeAuditRows(rows),
    },
  });
}

function clampLimit(value) {
  const parsed = Number.parseInt(String(value ?? "50"), 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(parsed, 200));
}

function normalizeAuditRows(rows) {
  return Array.isArray(rows)
    ? rows.map((row) => {
        const payload = safeJsonParse(row?.payload_json ?? row?.payload ?? row ?? {});
        return {
          id: row?.id ?? payload?.id ?? `${payload?.entityType ?? payload?.action ?? "audit"}-${Date.now()}`,
          entityType: row?.entity_type ?? payload?.entityType ?? payload?.type ?? "system",
          entityId: row?.entity_id ?? payload?.entityId ?? payload?.entity_id ?? null,
          action: payload?.action ?? payload?.event ?? row?.entity_type ?? "event",
          actor: payload?.actor ?? payload?.by ?? payload?.user ?? null,
          createdAt: row?.created_at ?? payload?.createdAt ?? payload?.created_at ?? null,
          payload,
        };
      })
    : [];
}

function safeJsonParse(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
