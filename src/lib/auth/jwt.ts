import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { ROLES } from "@/lib/constants";

const SESSION_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-secret-change-me"
);
const POS_SECRET = new TextEncoder().encode(
  process.env.POS_TOKEN_SECRET || process.env.AUTH_SECRET || "dev-only-secret-change-me"
);

export interface SessionClaims extends JWTPayload {
  sub: string; // profile id
  role: string; // SUPER_ADMIN | CLIENT
  clientId: string | null;
}

export interface DeviceTokenClaims extends JWTPayload {
  deviceId: string;
  restaurantId: string;
  licenseId: string;
  licenseKey: string;
  deviceIdentifier: string;
  scope: "pos";
}

// ─────────────────────── Web session JWT (httpOnly cookie) ───────────────────────

export async function signSessionToken(claims: SessionClaims, maxAgeSeconds: number) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("cafeflow-web")
    .setAudience("cafeflow-web")
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(SESSION_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      issuer: "cafeflow-web",
      audience: "cafeflow-web",
    });
    if (!payload.sub || !payload.role) return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

// ─────────────────────── POS device token JWT (Authorization: Bearer) ───────────────────────

export async function signDeviceToken(claims: DeviceTokenClaims, maxAge: string) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("cafeflow-pos")
    .setAudience("cafeflow-pos")
    .setExpirationTime(maxAge)
    .sign(POS_SECRET);
}

export async function verifyDeviceToken(token: string): Promise<DeviceTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, POS_SECRET, {
      issuer: "cafeflow-pos",
      audience: "cafeflow-pos",
    });
    if (payload.scope !== "pos" || !payload.deviceId || !payload.restaurantId) return null;
    return payload as DeviceTokenClaims;
  } catch {
    return null;
  }
}

export function roleIsAdmin(role: string) {
  return role === ROLES.SUPER_ADMIN;
}
