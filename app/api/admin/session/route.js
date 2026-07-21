import { NextResponse } from "next/server";
import { isAdminLoginConfigured, readAdminFromRequest } from "app/lib/adminAuth";

export async function GET(request) {
  const session = readAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({
      ok: true,
      data: {
        authenticated: false,
        loginConfigured: isAdminLoginConfigured(),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      authenticated: true,
      email: session.email,
      role: session.role,
      loginConfigured: isAdminLoginConfigured(),
    },
  });
}
