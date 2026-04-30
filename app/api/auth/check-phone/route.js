import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET() {
  const payload = await buildRecoveredPayload("api/auth/check-phone");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/check-phone",
    data: payload,
  });
}
