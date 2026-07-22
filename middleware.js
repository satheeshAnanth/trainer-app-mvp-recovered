import { NextResponse } from "next/server";

const TRAINER_PATHS = ["/portal", "/clients", "/schedule", "/profile", "/sessions"];
const CLIENT_PATHS = ["/my-portal"];
const BLOCKED_BILLING_STATUSES = ["suspended", "expired"];

function matchesPrefix(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Admin console — cookie gate (login page is public)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
      return NextResponse.next();
    }
    const adminSession = request.cookies.get("admin_session")?.value;
    if (!adminSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/exercises" || pathname.startsWith("/exercises/")) {
    const trainerSession = request.cookies.get("trainer_session")?.value;
    const clientSession = request.cookies.get("client_session")?.value;
    if (!trainerSession && !clientSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (matchesPrefix(pathname, TRAINER_PATHS)) {
    const trainerSession = request.cookies.get("trainer_session")?.value;
    if (!trainerSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    const billingStatus = request.cookies.get("trainer_billing_status")?.value;
    if (billingStatus && BLOCKED_BILLING_STATUSES.includes(billingStatus)) {
      const url = request.nextUrl.clone();
      url.pathname = "/suspended";
      url.searchParams.set("reason", billingStatus);
      return NextResponse.redirect(url);
    }
  }

  if (matchesPrefix(pathname, CLIENT_PATHS)) {
    const clientSession = request.cookies.get("client_session")?.value;
    if (!clientSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      url.searchParams.set("reason", "login_required");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/portal",
    "/portal/:path*",
    "/clients/:path*",
    "/schedule",
    "/schedule/:path*",
    "/profile",
    "/profile/:path*",
    "/sessions",
    "/sessions/:path*",
    "/exercises",
    "/exercises/:path*",
    "/my-portal",
    "/my-portal/:path*",
  ],
};
