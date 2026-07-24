import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "app/lib/db";
import { getGymAdminByPhone, normalizePhone } from "app/lib/gyms";

/** POST /api/gym/check-phone — record-level gym admin lookup (same pattern as trainer/client). */
export async function POST(request) {
  const body = await request.json();
  const phone = normalizePhone(body?.phone);

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: { exists: false, phone, source: "mock" },
    });
  }

  const admin = await getGymAdminByPhone(phone);
  const exists = Boolean(admin && admin.gym_status === "active");

  return NextResponse.json({
    ok: true,
    data: {
      exists,
      phone,
      gymId: exists ? admin.gym_id : null,
      gymName: exists ? admin.gym_name : null,
      source: "database",
    },
  });
}
