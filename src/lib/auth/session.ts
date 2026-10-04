import { cookies } from "next/headers";
import { cache } from "react";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  ROLES,
} from "@/lib/constants";
import {
  signSessionToken,
  verifySessionToken,
  type SessionClaims,
} from "./jwt";
import { db } from "@/lib/db";

export interface SessionUser {
  profileId: string;
  email: string;
  fullName: string;
  role: string;
  clientId: string | null;
  phone: string | null;
}

/** Issues the httpOnly session cookie after successful login. */
export async function createSession(user: {
  id: string;
  role: string;
  clientId: string | null;
}) {
  const token = await signSessionToken(
    { sub: user.id, role: user.role, clientId: user.clientId },
    SESSION_MAX_AGE_SECONDS,
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Reads and verifies the session cookie, then re-checks the user against the
 * database (revocation-safe: suspended accounts lose access immediately).
 *
 * Memoized per request via React cache(): the guard runs in the layout AND the
 * page of a route — this makes both share one JWT verification and one DB
 * query instead of duplicating them.
 */
export const getSessionUser = cache((): Promise<SessionUser | null> =>
  _getSessionUserImpl()
);

async function _getSessionUserImpl(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims: SessionClaims | null = await verifySessionToken(token);
  if (!claims) return null;

  let profile;
  try {
    profile = await db.profile.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        clientId: true,
        phone: true,
        isActive: true,
        client: { select: { status: true } },
      },
    });
  } catch (error) {
    console.error("[auth] Database unavailable during session lookup", error);
    return null;
  }
  if (!profile || !profile.isActive) return null;
  // A suspended client business also blocks its login account
  if (profile.role === ROLES.CLIENT && profile.client?.status !== "ACTIVE")
    return null;

  return {
    profileId: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    clientId: profile.clientId,
    phone: profile.phone,
  };
}
