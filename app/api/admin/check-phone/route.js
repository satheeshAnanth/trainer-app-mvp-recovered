import { NextResponse } from "next/server";
import { isPlatformAdminPhone, normalizeIndiaPhone } from "app/lib/fixedOtp";

/** POST /api/admin/check-phone — platform admin allowlist lookup. */
export async function POST(request) {
  const body = await request.json();
  const phone = normalizeIndiaPhone(body?.phone);

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }

  const exists = isPlatformAdminPhone(phone);
  return NextResponse.json({
    ok: true,
    data: { exists, phone, role: exists ? "platform_admin" : null },
  });
}
