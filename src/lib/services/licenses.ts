import { db } from "@/lib/db";
import { generateLicenseKey } from "@/lib/license-key";
import { LICENSE_EXPIRING_SOON_DAYS } from "@/lib/constants";

/**
 * License service — all transitions happen server-side.
 * A restaurant may hold exactly ONE non-revoked license; REVOKED licenses are
 * retained for audit history and free the restaurant for a new key.
 */

export async function getCurrentLicense(restaurantId: string) {
  return db.license.findFirst({
    where: { restaurantId, status: { not: "REVOKED" } },
    orderBy: { createdAt: "desc" },
  });
}

export async function generateLicenseForRestaurant(opts: {
  restaurantId: string;
  maxDevices?: number;
  expiresInMonths?: number;
}) {
  const restaurant = await db.restaurant.findUnique({
    where: { id: opts.restaurantId },
    select: { id: true, name: true, status: true, clientId: true },
  });
  if (!restaurant) throw new LicenseError("RESTAURANT_NOT_FOUND", "Restaurant not found.");
  if (restaurant.status === "DEACTIVATED")
    throw new LicenseError("CONFLICT", "Cannot issue a license for a deactivated restaurant.");

  const existing = await getCurrentLicense(opts.restaurantId);
  if (existing)
    throw new LicenseError(
      "CONFLICT",
      `${restaurant.name} already has a ${existing.status} license. Revoke it first to issue a new one.`
    );

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + (opts.expiresInMonths ?? 12));

  // Key collision is astronomically unlikely (36^12) but retry to be safe
  for (let attempt = 0; attempt < 3; attempt++) {
    const licenseKey = generateLicenseKey();
    try {
      return await db.license.create({
        data: {
          restaurantId: opts.restaurantId,
          licenseKey,
          status: "ACTIVE",
          maxDevices: opts.maxDevices ?? 1,
          activatedAt: new Date(),
          expiresAt,
        },
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e;
    }
  }
  throw new LicenseError("INTERNAL_ERROR", "Could not generate a unique license key.");
}

export class LicenseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Grouping helper used by dashboards and lists. */
export function licenseBucket(status: string, expiresAt: Date): string {
  if (status === "ACTIVE") {
    const days = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
    if (days < 0) return "EXPIRED";
    if (days <= LICENSE_EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
    return "ACTIVE";
  }
  return status;
}

/** Flips ACTIVE licenses whose expiry has passed to EXPIRED (housekeeping on read). */
export async function refreshExpiredLicenses() {
  const result = await db.license.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
