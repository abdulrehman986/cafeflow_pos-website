import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireClientApi, assertRestaurantAccess } from "@/lib/auth/guards";
import { listOrders } from "@/lib/services/dashboard";
import { ordersQuerySchema } from "@/lib/validators";
import { db } from "@/lib/db";

/**
 * GET /api/client/orders?restaurantId=…&from=…&to=…&status=…&page=…
 * GET /api/client/orders?orderId=…  → single order with items (ownership-checked)
 */
export const GET = handler(async (req: NextRequest) => {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;
  const clientId = auth.user.clientId!;

  const url = new URL(req.url);

  // Single order detail
  const orderId = url.searchParams.get("orderId");
  if (orderId) {
    const order = await db.order.findFirst({
      where: { id: orderId, restaurant: { clientId } },
      include: {
        restaurant: { select: { id: true, name: true } },
        items: true,
      },
    });
    if (!order) return fail("NOT_FOUND", "Order not found.");
    return ok({ order });
  }

  const parsed = ordersQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? 15,
    restaurantId: url.searchParams.get("restaurantId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    search: url.searchParams.get("q") ?? undefined,
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid query parameters.");
  const q = parsed.data;

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

  const result = await listOrders({
    restaurantIds,
    page: q.page,
    pageSize: q.pageSize,
    from,
    to,
    status: q.status,
    search: q.search,
  });
  return ok(result);
});
