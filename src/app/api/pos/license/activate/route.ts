import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { posActivateSchema } from "@/lib/validators";
import { activateDevice, PosError } from "@/lib/services/pos";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/pos/license/activate
 * Body: { licenseKey, deviceIdentifier, deviceName?, osInfo?, appVersion? }
 *
 * No browser/session auth — this is the machine-to-machine activation endpoint.
 * Rate limited per IP; validates the full chain license → restaurant → client
 * before minting a device token.
 */
export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`pos-activate:${clientIp(req)}`, 10, 300);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", `Too many activation attempts. Retry in ${rl.retryAfterSeconds}s.`);
  }

  const body = await req.json().catch(() => null);
  const parsed = posActivateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid activation payload.");
  }

  try {
    const result = await activateDevice({
      licenseKey: parsed.data.licenseKey,
      deviceIdentifier: parsed.data.deviceIdentifier,
      deviceName: parsed.data.deviceName,
      osInfo: parsed.data.osInfo,
      appVersion: parsed.data.appVersion,
    });
    return ok(result);
  } catch (e) {
    if (e instanceof PosError) return fail(e.code as never, e.message);
    throw e;
  }
});
