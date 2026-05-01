import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mockData } from "app/lib/mockData";
import { normalizeBillingModel, PRICING_MODEL } from "app/lib/pricingModel";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

export async function GET() {
  const payload = await buildRecoveredPayload("api/clients");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients",
    data: payload,
  });
}

export async function POST(request) {
  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const goal = String(body?.goal ?? "").trim();
  const mobile = normalizePhone(body?.mobile);
  const age = body?.age ? Number(body.age) : null;
  const weightKg = body?.weightKg ? Number(body.weightKg) : null;
  const heightCm = body?.heightCm ? Number(body.heightCm) : null;
  const gender = String(body?.gender ?? "").trim() || null;
  const activityLevel = String(body?.activityLevel ?? "").trim() || null;
  const priorCondition = String(body?.priorCondition ?? "").trim() || null;
  const trainerPhone = request.cookies.get("trainer_session")?.value ?? null;

  if (!name || !mobile) {
    return NextResponse.json({ ok: false, message: "Name and mobile are required." }, { status: 400 });
  }
  if (!trainerPhone) {
    return NextResponse.json({ ok: false, message: "Trainer login required." }, { status: 401 });
  }

  const mobileDigits = mobile.replace(/\D/g, "");

  if (!hasDatabaseUrl()) {
    const mockCurrentCount = (mockData?.clients ?? []).length;
    const mockBillingModel = normalizeBillingModel(mockData?.trainerProfile?.billing_status ?? "trial");
    const mockLimit = mockBillingModel === "trial" ? PRICING_MODEL.trial.clientLimit : PRICING_MODEL.perClient.clientLimit;
    if (mockCurrentCount >= mockLimit) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Trial client limit reached. Switch to per-client pricing to add more clients.",
          data: {
            billingModel: mockBillingModel,
            currentClients: mockCurrentCount,
            clientLimit: mockLimit,
            perClientCostInr: PRICING_MODEL.perClient.perClientCostInr,
          },
        },
        { status: 402 }
      );
    }

    const trainerConflict = (mockData?.trainerProfile?.phone ?? "").replace(/\D/g, "") === mobileDigits;
    if (trainerConflict) {
      return NextResponse.json(
        {
          ok: false,
          message: "This number is already registered as a trainer and cannot be added as a client.",
        },
        { status: 409 }
      );
    }

    const existingClient = (mockData?.clients ?? []).find(
      (c) => String(c?.mobile ?? c?.phone ?? "").replace(/\D/g, "") === mobileDigits
    );
    if (existingClient) {
      return NextResponse.json(
        {
          ok: false,
          message: "This number already exists as a client and cannot be added again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/clients",
        data: {
          id: `mock-client-${Date.now()}`,
          name,
          goal,
          mobile,
          age,
          weight_kg: weightKg,
          height_cm: heightCm,
          gender,
          activity_level: activityLevel,
          prior_condition: priorCondition,
          source: "mock",
        },
      },
      { status: 201 }
    );
  }

  const trainerRows = await query(
    `
      SELECT
        phone,
        billing_status,
        max_clients
      FROM trainer_phones
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
      LIMIT 1
    `,
    [trainerPhone]
  );
  const trainerRow = trainerRows[0];
  if (!trainerRow) {
    return NextResponse.json({ ok: false, message: "Trainer profile not found." }, { status: 404 });
  }

  const billingModel = normalizeBillingModel(trainerRow.billing_status ?? "trial");
  const fallbackLimit = billingModel === "trial" ? PRICING_MODEL.trial.clientLimit : PRICING_MODEL.perClient.clientLimit;
  const maxClients = Number(trainerRow.max_clients ?? fallbackLimit);
  const clientCountRows = await query(
    `
      SELECT COUNT(*)::int AS count
      FROM clients
      WHERE regexp_replace(COALESCE(created_by_trainer, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
    `,
    [trainerPhone]
  );
  const currentClients = Number(clientCountRows[0]?.count ?? 0);
  if (currentClients >= maxClients) {
    return NextResponse.json(
      {
        ok: false,
        message:
          billingModel === "trial"
            ? "Trial client limit reached. Switch to per-client pricing to add more clients."
            : "Client limit reached for current plan. Contact support to increase your limit.",
        data: {
          billingModel,
          currentClients,
          clientLimit: maxClients,
          perClientCostInr: PRICING_MODEL.perClient.perClientCostInr,
        },
      },
      { status: 402 }
    );
  }

  const trainerConflictRows = await query(
    `
      SELECT id
      FROM trainer_phones
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
      LIMIT 1
    `,
    [mobileDigits]
  );
  if (trainerConflictRows[0]) {
    return NextResponse.json(
      {
        ok: false,
        message: "This number is already registered as a trainer and cannot be added as a client.",
      },
      { status: 409 }
    );
  }

  const clientRows = await query(
    `
      SELECT id, created_by_trainer
      FROM clients
      WHERE regexp_replace(COALESCE(mobile, ''), '[^0-9]', '', 'g') = $1
      LIMIT 1
    `,
    [mobileDigits]
  );
  if (clientRows[0]) {
    return NextResponse.json(
      {
        ok: false,
        message: "This number already exists as a client and cannot be added again.",
        data: { existingClientId: clientRows[0].id, createdByTrainer: clientRows[0].created_by_trainer ?? null },
      },
      { status: 409 }
    );
  }

  const rows = await query(
    `
      INSERT INTO clients (
        id,
        name,
        goal,
        mobile,
        age,
        weight_kg,
        height_cm,
        gender,
        activity_level,
        created_by_trainer,
        created_at,
        updated_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [
      name,
      goal || null,
      mobile,
      Number.isFinite(age) ? age : null,
      Number.isFinite(weightKg) ? weightKg : null,
      Number.isFinite(heightCm) ? heightCm : null,
      gender,
      activityLevel,
      trainerPhone,
    ]
  );

  if (priorCondition) {
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
          'client_intake',
          $1,
          'prior_condition_recorded',
          $2::text,
          NOW()
        )
      `,
      [
        rows[0].id,
        JSON.stringify({
          priorCondition,
          gender,
          activityLevel,
          capturedBy: trainerPhone,
        }),
      ]
    ).catch(() => null);
  }

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/clients",
      data: { ...rows[0], prior_condition: priorCondition },
    },
    { status: 201 }
  );
}
