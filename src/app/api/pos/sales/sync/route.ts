import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { posSalesSyncSchema } from "@/lib/validators";
import { authenticatePosDevice, syncSales, PosError } from "@/lib/services/pos";
import { deviceTokenFrom } from "@/lib/pos-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/pos/sales/sync
 * Body: { sales: [{ localSaleId, saleDate, total, … }], batchId? }
 * Auth: Authorization: Bearer <device-token>
 *
 * IDEMPOTENT: (restaurant_id, local_sale_id) is unique — re-uploading the
 * same sale (e.g. after a network failure) is detected and skipped, and the
 * per-record outcome is reported back so the POS can clear its queue safely.
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
  const parsed = posSalesSyncSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid sync payload.");
  }

  try {
    const ctx = await authenticatePosDevice(token);
    const result = await syncSales(ctx, parsed.data.sales);
    return ok({
      ...result,
      serverTime: new Date().toISOString(),
      message: `Synced ${result.created} new sales, skipped ${result.skipped} duplicates.`,
    });
  } catch (e) {
    if (e instanceof PosError) return fail(e.code as never, e.message);
    throw e;
  }
});
