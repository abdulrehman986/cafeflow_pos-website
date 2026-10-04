import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { deviceTokenFrom } from "@/lib/pos-auth";
import { authenticatePosDevice, licenseVerificationPayload, PosError } from "@/lib/services/pos";

/**
 * GET /api/pos/license/verify
 * Two modes:
 *  a) with device token → full verification, refreshes lastVerifiedAt
 *  b) license key only  → lightweight status (pre-activation checks)
 */
export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`pos-verify:${clientIp(req)}`, 60, 60);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", `Too many verification attempts. Retry in ${rl.retryAfterSeconds}s.`);
  }

  const token = deviceTokenFrom(req);
  const body = (await req.json().catch(() => ({}))) as { licenseKey?: string };

  if (token) {
    try {
      const ctx = await authenticatePosDevice(token);
      // Verification refreshes the license's lastVerifiedAt (server = source of truth)
      await db.license.update({ where: { id: ctx.license.id }, data: { lastVerifiedAt: new Date() } });
      const payload = licenseVerificationPayload(ctx);
      payload.offlineGrace.daysSinceLastVerification = 0;
      return ok(payload);
    } catch (e) {
      if (e instanceof PosError) return fail(e.code as never, e.message);
      throw e;
    }
  }

  // License-key-only mode (e.g. pre-activation checks)
  const licenseKey = typeof body.licenseKey === "string" ? body.licenseKey : "";
  if (!licenseKey) {
    return fail("UNAUTHORIZED", "Provide a device token or a licenseKey.");
  }
  const license = await db.license.findUnique({
    where: { licenseKey: licenseKey.toUpperCase() },
    include: { restaurant: { select: { name: true, status: true } } },
  });
  if (!license) return fail("LICENSE_NOT_FOUND", "License key not found.");
  // Deliberately omit restaurant metadata here: this mode is unauthenticated
  // and must not leak which business a key belongs to.
  return ok({
    licenseKey: license.licenseKey,
    status: license.status,
    expiresAt: license.expiresAt,
    daysRemaining: Math.max(0, Math.ceil((license.expiresAt.getTime() - Date.now()) / 86400000)),
    maxDevices: license.maxDevices,
    serverTime: new Date().toISOString(),
  });
});
