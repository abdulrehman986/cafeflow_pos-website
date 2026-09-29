import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { posOrdersSyncSchema } from "@/lib/validators";
import { authenticatePosDevice, syncOrders, PosError } from "@/lib/services/pos";
import { deviceTokenFrom } from "@/lib/pos-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/pos/orders/sync
 * Body: { orders: [{ localOrderId, orderNumber, orderDate, total, items: […] }], batchId? }
 * Auth: Authorization: Bearer <device-token>
 *
 * IDEMPOTENT: (restaurant_id, local_order_id) is unique — replays are skipped.
 */
export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`pos-sync:${clientIp(req)}`, 120, 60);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", `Rate limit reached. Retry in ${rl.retryAfterSeconds}s.`);
  }

  const token = deviceTokenFrom(req);
  if (!token) {
    return fail("UNAUTHORIZED", "Missing device token. Send 'Authorization: Bearer <token>'.");
  }

  const body = await req.json().catch(() => null);
  const parsed = posOrdersSyncSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid sync payload.");
  }

  try {
    const ctx = await authenticatePosDevice(token);
    const result = await syncOrders(ctx, parsed.data.orders);
    return ok({
      ...result,
      serverTime: new Date().toISOString(),
      message: `Synced ${result.created} new orders, skipped ${result.skipped} duplicates.`,
    });
  } catch (e) {
    if (e instanceof PosError) return fail(e.code as never, e.message);
    throw e;
  }
});
