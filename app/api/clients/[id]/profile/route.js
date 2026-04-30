import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/clients/[id]/profile", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients/[id]/profile",
    data: payload,
  });
}
