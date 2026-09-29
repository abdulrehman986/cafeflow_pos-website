import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { deviceTokenFrom } from "@/lib/pos-auth";
import { authenticatePosDevice, licenseVerificationPayload, PosError } from "@/lib/services/pos";
import { db } from "@/lib/db";
import { startOfDayUTC } from "@/lib/format";

/**
 * GET /api/pos/restaurant/config
 * Auth: Authorization: Bearer <device-token>
 *
 * Startup configuration bundle for the POS: restaurant identity, license
 * snapshot (with grace info) and today's sync counters so the POS can
 * reconcile its local queue with the server.
 */
export const GET = handler(async (req: NextRequest) => {
  const token = deviceTokenFrom(req);
  if (!token) {
    return fail("UNAUTHORIZED", "Missing device token. Send 'Authorization: Bearer <token>'.");
  }

  try {
    const ctx = await authenticatePosDevice(token);
    const todayStart = startOfDayUTC(new Date());
    const [todaySales, todayOrders, lastSync] = await Promise.all([
      db.sale.count({ where: { restaurantId: ctx.restaurant.id, saleDate: { gte: todayStart } } }),
      db.order.count({ where: { restaurantId: ctx.restaurant.id, orderDate: { gte: todayStart } } }),
      db.syncLog.findFirst({
        where: { restaurantId: ctx.restaurant.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, recordType: true, recordsCreated: true },
      }),
    ]);

    const restaurantRow = await db.restaurant.findUnique({
      where: { id: ctx.restaurant.id },
      select: { name: true, city: true, phone: true, address: true },
    });

    return ok({
      restaurant: {
        id: ctx.restaurant.id,
        name: ctx.restaurant.name,
        city: restaurantRow?.city ?? null,
        phone: restaurantRow?.phone ?? null,
        address: restaurantRow?.address ?? null,
      },
      client: { id: ctx.client.id, name: ctx.client.name },
      license: licenseVerificationPayload(ctx),
      sync: {
        todaySalesSynced: todaySales,
        todayOrdersSynced: todayOrders,
        lastSyncAt: lastSync?.createdAt ?? null,
        lastSyncRecords: lastSync?.recordsCreated ?? 0,
      },
      device: ctx.device,
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof PosError) return fail(e.code as never, e.message);
    throw e;
  }
});
