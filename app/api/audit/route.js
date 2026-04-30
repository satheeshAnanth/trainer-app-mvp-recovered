import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET() {
  const payload = await buildRecoveredPayload("api/audit");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/audit",
    data: payload,
  });
}
