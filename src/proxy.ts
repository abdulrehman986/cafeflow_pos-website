import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cf_session";
const SESSION_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-secret-change-me"
);

/**
 * CORS for the POS device API (/api/pos/*).
 *
 * The Tauri desktop POS runs on a separate origin (http://tauri.localhost on
 * Windows) and calls /api/pos/* from its webview. Without these headers the
 * browser engine blocks every request at preflight — the API itself was never
 * the problem. The endpoints are bearer-token authenticated (no cookies), so
 * CORS here is about enabling the client, not protecting it.
 *
 * Allowed: Tauri webview origins + localhost (local development).
 */
const TAURI_ORIGINS = new Set([
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
]);

const LOCAL_ORIGIN = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return TAURI_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Device-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * Proxy (formerly middleware): fast cookie + role gate for /admin and /client
 * pages, plus CORS for the POS device API.
 * NOTE: this is a first line of defense only. Every layout, page and API
 * re-verifies the session against the database (see lib/auth/guards.ts).
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin");

  // POS device API: answer preflight directly, tag real requests with CORS
  // headers, and skip the cookie gate entirely (POS auth is a device token).
  if (pathname.startsWith("/api/pos")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      response.headers.set(key, value);
    }
    return response;
  }

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
  matcher: ["/admin/:path*", "/client/:path*", "/login", "/api/pos/:path*"],
};
