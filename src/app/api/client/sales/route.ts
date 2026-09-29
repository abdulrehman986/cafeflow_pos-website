import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireClientApi, assertRestaurantAccess } from "@/lib/auth/guards";
import { listSales, getSalesSeries, getPaymentSplit } from "@/lib/services/dashboard";
import { salesQuerySchema } from "@/lib/validators";
import { startOfDayUTC, addDays } from "@/lib/format";
import { db } from "@/lib/db";

/**
 * GET /api/client/sales?restaurantId=…&from=…&to=…&page=…
 * restaurantId is validated against the caller's ownership before ANY query runs.
 */
export const GET = handler(async (req: NextRequest) => {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;
  const clientId = auth.user.clientId!;

  const url = new URL(req.url);
  const parsed = salesQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? 15,
    restaurantId: url.searchParams.get("restaurantId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    paymentMethod: url.searchParams.get("paymentMethod") ?? undefined,
    search: url.searchParams.get("q") ?? undefined,
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid query parameters.");
  const q = parsed.data;

  // Resolve the restaurant scope — always from the session, never trusted blindly
  let restaurantIds: string[];
  if (q.restaurantId) {
    const access = await assertRestaurantAccess(auth.user, q.restaurantId);
    if (!access.ok) return access.response;
    restaurantIds = [q.restaurantId];
  } else {
    const owned = await db.restaurant.findMany({ where: { clientId }, select: { id: true } });
    restaurantIds = owned.map((r) => r.id);
  }

  const from = q.from ? new Date(q.from + "T00:00:00Z") : undefined;
  const to = q.to ? new Date(q.to + "T23:59:59Z") : undefined;

  const [result, series, paymentSplit] = await Promise.all([
    listSales({ restaurantIds, page: q.page, pageSize: q.pageSize, from, to, paymentMethod: q.paymentMethod, search: q.search }),
    getSalesSeries({ restaurantIds, from: from ?? addDays(startOfDayUTC(new Date()), -29), to: to ?? new Date() }),
    getPaymentSplit({ restaurantIds, from, to }),
  ]);

  return ok({ ...result, series, paymentSplit });
});
