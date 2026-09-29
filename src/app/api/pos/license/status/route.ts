import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { deviceTokenFrom } from "@/lib/pos-auth";
import { authenticatePosDevice, licenseVerificationPayload, PosError } from "@/lib/services/pos";

/**
 * GET /api/pos/license/status
 * Device-token authenticated license snapshot for periodic POS polling.
 * Includes the offline grace-period state the POS uses when connectivity is poor.
 */
export const GET = handler(async (req: NextRequest) => {
  const token = deviceTokenFrom(req);
  if (!token) {
    return fail("UNAUTHORIZED", "Missing device token. Send 'Authorization: Bearer <token>'.");
  }
  try {
    const ctx = await authenticatePosDevice(token);
    return ok(licenseVerificationPayload(ctx));
  } catch (e) {
    if (e instanceof PosError) return fail(e.code as never, e.message);
    throw e;
  }
});
