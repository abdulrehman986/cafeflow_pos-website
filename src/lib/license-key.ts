import { randomBytes } from "crypto";

/**
 * License keys look like CF-XXXX-XXXX-XXXX (e.g. CF-7K2M-9QF4-XR8T).
 * Generated ONLY on the server with crypto randomness, using an unambiguous
 * alphabet (no 0/O, 1/I, 5/S). Keys are never generated or embedded client-side.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ2346789";

function randomChars(n: number): string {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateLicenseKey(): string {
  return `CF-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`;
}

/** Computes license display status: real status + days remaining. */
export function licenseEffectiveStatus(license: {
  status: string;
  expiresAt: Date;
}): { effectiveStatus: string; daysRemaining: number } {
  const days = daysUntil(license.expiresAt);
  if (license.status === "ACTIVE" && days <= 0) {
    return { effectiveStatus: "EXPIRED", daysRemaining: Math.max(0, days) };
  }
  return { effectiveStatus: license.status, daysRemaining: Math.max(0, days) };
}

export function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
