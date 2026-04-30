import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/schedule/events/[id]/status", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]/status",
    data: payload,
  });
}
