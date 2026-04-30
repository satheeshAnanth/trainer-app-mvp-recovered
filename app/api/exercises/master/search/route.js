import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET() {
  const payload = await buildRecoveredPayload("api/exercises/master/search");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/exercises/master/search",
    data: payload,
  });
}
