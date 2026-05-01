import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { pricingPayload } from "app/lib/pricingModel";

export async function GET() {
  const payload = await buildRecoveredPayload("api/auth/pricing");
  const pricing = pricingPayload();
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/pricing",
    data: {
      ...payload,
      ...pricing,
    },
  });
}
