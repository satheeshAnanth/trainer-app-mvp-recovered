import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { requireAdminSecret } from "app/lib/adminAuth";

export async function GET(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  const payload = await buildRecoveredPayload("api/admin/restore");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/admin/restore",
    data: payload,
  });
}
