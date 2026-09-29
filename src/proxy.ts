import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cf_session";
const SESSION_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-secret-change-me"
);

/**
 * Proxy (formerly middleware): fast cookie + role gate for /admin and /client pages.
 * NOTE: this is a first line of defense only. Every layout, page and API
 * re-verifies the session against the database (see lib/auth/guards.ts).
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET, {
        issuer: "cafeflow-web",
        audience: "cafeflow-web",
      });
      role = (payload.role as string) ?? null;
    } catch {
      role = null;
    }
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isClientRoute = pathname.startsWith("/client");

  if ((isAdminRoute || isClientRoute) && !role) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/client", req.url));
  }
  if (isClientRoute && role === "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Logged-in users skip the login screen
  if (pathname === "/login" && role) {
    return NextResponse.redirect(new URL(role === "SUPER_ADMIN" ? "/admin" : "/client", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client/:path*", "/login"],
};
