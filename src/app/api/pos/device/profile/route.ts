import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { deviceTokenFrom } from "@/lib/pos-auth";
import { authenticatePosDevice, PosError } from "@/lib/services/pos";
import { posDeviceProfileSchema } from "@/lib/validators";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/pos/device/profile
 * Body: { deviceName, osInfo?, appVersion? }
 *
 * Device-token authenticated profile refresh. The POS calls this after the
 * user renames the terminal in Settings (and once per session) so the
 * client/admin dashboards show the real terminal name without requiring a
 * license re-activation.
 */
export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`pos-profile:${clientIp(req)}`, 30, 300);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", `Too many profile updates. Retry in ${rl.retryAfterSeconds}s.`);
  }

  const token = deviceTokenFrom(req);
  if (!token) {
    return fail("UNAUTHORIZED", "Missing device token. Send 'Authorization: Bearer <token>'.");
  }

  const body = await req.json().catch(() => null);
  const parsed = posDeviceProfileSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid profile payload.");
  }

  try {
    const ctx = await authenticatePosDevice(token);
    await db.device.update({
      where: { id: ctx.device.id },
      data: {
        deviceName: parsed.data.deviceName,
        ...(parsed.data.osInfo !== undefined ? { osInfo: parsed.data.osInfo } : {}),
        ...(parsed.data.appVersion !== undefined ? { appVersion: parsed.data.appVersion } : {}),
      },
    });
    return ok({ message: "Device profile updated." });
  } catch (e) {
    if (e instanceof PosError) return fail(e.code as never, e.message);
    throw e;
  }
});
