import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";
import { requireTrainerOwnsSession } from "app/lib/ownership";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]/payment", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/payment",
    data: payload,
  });
}

export async function POST(request, { params }) {
  const { id } = params;
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!phone) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const body = await request.json();
  const amountInr = Number(body?.amountInr ?? 0);
  const upiId = String(body?.upiId ?? "").trim();
  const note = String(body?.note ?? "").trim();

  if (!id) {
    return NextResponse.json({ ok: false, message: "Session id is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]/payment",
      data: { id, amount_inr: amountInr, upi_id: upiId, note, status: "not_requested", source: "mock" },
    });
  }

  const owned = await requireTrainerOwnsSession(phone, id);
  if (!owned) return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  const trainerPhone = phone;

  if (trainerPhone) {
    const monthYear = new Date().toISOString().slice(0, 7);
    await query(
      `
        INSERT INTO billing_records (
          id,
          trainer_phone,
          month_year,
          active_clients,
          amount_inr,
          status,
          created_at
        )
        VALUES (
          md5(random()::text || clock_timestamp()::text),
          $1,
          $2,
          0,
          $3,
          'pending',
          NOW()
        )
      `,
      [trainerPhone, monthYear, Number.isFinite(amountInr) ? amountInr : 0]
    ).catch(() => null);
  }

  await query(
    `
      INSERT INTO audit_events (
        id,
        entity_type,
        entity_id,
        action,
        payload_json,
        created_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        'session_payment',
        $1,
        'payment_requested',
        $2::text,
        NOW()
      )
    `,
    [
      id,
      JSON.stringify({
        amountInr: Number.isFinite(amountInr) ? amountInr : null,
        upiId,
        note,
      }),
    ]
  ).catch(() => null);

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/payment",
    data: { id, amount_inr: amountInr, upi_id: upiId, note, status: "pending", source: "database" },
  });
}
