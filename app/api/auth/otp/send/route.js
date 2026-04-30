import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET() {
  const payload = await buildRecoveredPayload("api/auth/otp/send");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/otp/send",
    data: payload,
  });
}
