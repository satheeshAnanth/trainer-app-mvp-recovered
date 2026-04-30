import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]/shared-notes", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/shared-notes",
    data: payload,
  });
}
