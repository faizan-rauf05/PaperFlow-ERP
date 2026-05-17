import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { getRoleDashboard, isRouteAllowedForRole } from "@/lib/roleAccess";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/setup-password",
  "/reset-password",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/setup-password",
  "/auth/reset-password",
];

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  if (pathname.startsWith("/api/auth")) {
    return true;
  }
  return false;
}

function isProtectedPath(pathname) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/api");
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  // Public paths — but redirect logged-in users away from /login
  if (!isProtectedPath(pathname) || isPublicPath(pathname)) {
    if (session?.user && pathname === "/login") {
      return NextResponse.redirect(new URL(getRoleDashboard(session.user.role), request.url));
    }
    return NextResponse.next();
  }

  // Not authenticated
  if (!session?.user) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;

  // Redirect /dashboard root to role-specific dashboard BEFORE role check
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return NextResponse.redirect(new URL(getRoleDashboard(role), request.url));
  }

  // Role-based access check
  if (!isRouteAllowedForRole(role, pathname)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(getRoleDashboard(role), request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/dashboard"],
};