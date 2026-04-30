import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/schedule/events/[id]/notes", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]/notes",
    data: payload,
  });
}
