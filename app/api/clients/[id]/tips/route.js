import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/clients/[id]/tips", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients/[id]/tips",
    data: payload,
  });
}
