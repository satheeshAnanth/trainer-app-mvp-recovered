import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET() {
  const payload = await buildRecoveredPayload("api/exercises/feedback");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/exercises/feedback",
    data: payload,
  });
}
