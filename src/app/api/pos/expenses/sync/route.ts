import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { posExpensesSyncSchema } from "@/lib/validators";
import { authenticatePosDevice, syncExpenses, PosError } from "@/lib/services/pos";
import { deviceTokenFrom } from "@/lib/pos-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/pos/expenses/sync
 * Body: { expenses: [{ localExpenseId, date, amount, … }], batchId? }
 * Auth: Authorization: Bearer <device-token>
 *
 * IDEMPOTENT: (restaurant_id, local_expense_id) is unique — re-uploading the
 * same expense is detected and skipped.
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
  const parsed = posExpensesSyncSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid sync payload.");
  }

  try {
    const ctx = await authenticatePosDevice(token);
    const result = await syncExpenses(ctx, parsed.data.expenses);
    return ok({
      ...result,
      serverTime: new Date().toISOString(),
      message: `Synced ${result.created} new expenses, skipped ${result.skipped} duplicates.`,
    });
  } catch (e) {
    if (e instanceof PosError) return fail(e.code as never, e.message);
    throw e;
  }
});
