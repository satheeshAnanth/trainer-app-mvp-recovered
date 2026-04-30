import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET() {
  const payload = await buildRecoveredPayload("api/invitations/validate");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/invitations/validate",
    data: payload,
  });
}
