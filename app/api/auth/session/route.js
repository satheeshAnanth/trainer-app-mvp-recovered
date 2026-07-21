import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";
import { getTrainerBillingStatus, reconcileExpiredTrials } from "app/lib/billingGuard";

export async function GET(request) {
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!phone) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/auth/session",
      data: { authenticated: false, source: "cookie" },
    });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/auth/session",
      data: {
        authenticated: true,
        user: { phone, role: "trainer" },
        source: "mock",
      },
    });
  }

  await reconcileExpiredTrials({ actor: "auth-session", phone, limit: 1 });

  const rows = await query(
    `SELECT id, phone, name, billing_status, trial_ends_at, max_clients FROM trainer_phones WHERE phone = $1 LIMIT 1`,
    [phone]
  );
  const trainer = rows[0] ?? null;

  const billing = await getTrainerBillingStatus(phone);

  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/session",
    data: {
      authenticated: Boolean(trainer),
      user: trainer,
      billing,
      source: "database",
    },
  });

  // Refresh the billing status cookie so middleware can enforce it at the edge.
  // Short TTL: 1 hour. Refreshed on every page load via the portal layout.
  response.cookies.set("trainer_billing_status", billing.status, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/session",
    data: { loggedOut: true },
  });
  response.cookies.set("trainer_session", "", { maxAge: 0, path: "/" });
  return response;
}
