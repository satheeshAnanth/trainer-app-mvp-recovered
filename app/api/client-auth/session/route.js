import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET() {
  const payload = await buildRecoveredPayload("api/client-auth/session");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/client-auth/session",
    data: payload,
  });
}
