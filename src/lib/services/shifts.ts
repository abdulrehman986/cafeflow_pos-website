import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Client-facing shift services. Every query is scoped by an explicit
 * `restaurantIds` list that callers derive from the session's clientId —
 * the same security boundary used by listSales/listOrders.
 * Shifts are uploaded by the POS when they CLOSE, so every record here is a
 * completed shift; "active" activity is approximated by terminal lastSeenAt.
 */

export type ShiftListRow = Prisma.ShiftGetPayload<{
  include: { restaurant: { select: { id: true; name: true } }; device: { select: { deviceName: true; deviceIdentifier: true } } };
}>;

export interface OpenShiftView {
  restaurantId: string;
  restaurantName: string;
  /** Close time of the last synced shift — null when no shift ever closed. */
  lastClosedAt: Date | null;
  /** First order after the last close — the inferred open time of the live shift. */
  since: Date;
  lastOrderAt: Date;
  orderCount: number;
  netSales: number;
}

/**
 * Derive each restaurant's currently-OPEN shift. The POS uploads a shift only
 * when it closes, so the live shift cannot exist in the shifts table — but its
 * orders sync in real time. Everything an order synced AFTER the latest closed
 * shift belongs to the shift that is still open.
 *
 * Two bounded queries per restaurant (aggregate + first-order lookup), never a
 * full-history scan from the app side.
 */
export async function getOpenShifts(
  restaurants: Array<{ id: string; name: string }>,
): Promise<OpenShiftView[]> {
  if (!restaurants.length) return [];
  const lastShifts = await db.shift.groupBy({
    by: ["restaurantId"],
    where: { restaurantId: { in: restaurants.map((r) => r.id) } },
    _max: { closedAt: true },
  });

  const views = await Promise.all(
    restaurants.map(async (restaurant) => {
      const lastClosedAt =
        lastShifts.find((s) => s.restaurantId === restaurant.id)?._max.closedAt ?? null;
      const where = {
        restaurantId: restaurant.id,
        ...(lastClosedAt ? { orderDate: { gt: lastClosedAt } } : {}),
      };
      const [agg, firstOrder] = await Promise.all([
        db.order.aggregate({ where, _count: true, _sum: { total: true }, _max: { orderDate: true } }),
        db.order.findFirst({ where, orderBy: { orderDate: "asc" }, select: { orderDate: true } }),
      ]);
      // No orders since the last close = no open shift right now.
      if (!agg._count || !firstOrder || !agg._max.orderDate) return null;
      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        lastClosedAt,
        since: firstOrder.orderDate,
        lastOrderAt: agg._max.orderDate,
        orderCount: agg._count,
        netSales: agg._sum.total ?? 0,
      } satisfies OpenShiftView;
    }),
  );
  return views.filter((v) => v !== null);
}

export async function listShifts(opts: {
  restaurantIds: string[];
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
}) {
  const where = {
    restaurantId: { in: opts.restaurantIds },
    ...(opts.from || opts.to
      ? { openedAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
      : {}),
  };
  const [rows, total, agg] = await Promise.all([
    db.shift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        restaurant: { select: { id: true, name: true } },
        device: { select: { deviceName: true, deviceIdentifier: true } },
      },
    }),
    db.shift.count({ where }),
    db.shift.aggregate({ where, _sum: { netSales: true, grossSales: true, orderCount: true } }),
  ]);
  return {
    rows,
    total,
    sumNet: agg._sum.netSales ?? 0,
    sumGross: agg._sum.grossSales ?? 0,
    sumOrders: agg._sum.orderCount ?? 0,
    page: opts.page,
    pageSize: opts.pageSize,
  };
}

export type ShiftDetail = NonNullable<Awaited<ReturnType<typeof getShiftDetail>>>;

/** One shift with its cash reconciliation, linked expenses and the orders
 *  rung up during the shift window (device-matched when attribution exists). */
export async function getShiftDetail(opts: { shiftId: string; restaurantIds: string[] }) {
  const shift = await db.shift.findFirst({
    where: { id: opts.shiftId, restaurantId: { in: opts.restaurantIds } },
    include: {
      restaurant: { select: { id: true, name: true } },
      device: { select: { id: true, deviceName: true, deviceIdentifier: true } },
    },
  });
  if (!shift) return null;

  const [expenses, orders] = await Promise.all([
    db.expense.findMany({
      where: { restaurantId: shift.restaurantId, shiftLocalId: shift.localShiftId },
      orderBy: { date: "asc" },
    }),
    db.order.findMany({
      where: {
        restaurantId: shift.restaurantId,
        orderDate: { gte: shift.openedAt, lte: shift.closedAt },
        // When the terminal is known, only its own orders belong to the shift.
        // (Older rows predate terminal attribution and keep window-only matching.)
        ...(shift.deviceId ? { deviceId: shift.deviceId } : {}),
      },
      orderBy: { orderDate: "asc" },
      select: {
        id: true,
        orderNumber: true,
        orderDate: true,
        paymentMethod: true,
        status: true,
        total: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  const ordersTotal = orders.reduce((a, o) => a + o.total, 0);
  const expensesTotal = expenses.reduce((a, e) => a + e.amount, 0);

  return { shift, expenses, orders, ordersTotal, expensesTotal };
}

export interface TerminalBreakdownRow {
  deviceId: string | null;
  deviceName: string;
  deviceIdentifier: string | null;
  salesTotal: number;
  salesCount: number;
  ordersTotal: number;
  ordersCount: number;
}

/** Sales/orders grouped by POS terminal. Records synced before terminal
 *  attribution exist are reported under "Unattributed". */
export async function getTerminalBreakdown(opts: {
  restaurantIds: string[];
  from?: Date;
  to?: Date;
}): Promise<TerminalBreakdownRow[]> {
  if (opts.restaurantIds.length === 0) return [];

  const dateFilter = (field: "saleDate" | "orderDate") =>
    opts.from || opts.to
      ? {
          [field]: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        }
      : {};

  const [salesRows, orderRows, devices] = await Promise.all([
    db.sale.groupBy({
      by: ["deviceId"],
      where: { restaurantId: { in: opts.restaurantIds }, status: "COMPLETED", ...dateFilter("saleDate") },
      _sum: { total: true },
      _count: true,
    }),
    db.order.groupBy({
      by: ["deviceId"],
      where: { restaurantId: { in: opts.restaurantIds }, ...dateFilter("orderDate") },
      _sum: { total: true },
      _count: true,
    }),
    db.device.findMany({
      where: { restaurantId: { in: opts.restaurantIds } },
      select: { id: true, deviceName: true, deviceIdentifier: true },
    }),
  ]);

  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const merged = new Map<string, TerminalBreakdownRow>();

  for (const r of salesRows) {
    const key = r.deviceId ?? "unattributed";
    const device = r.deviceId ? deviceById.get(r.deviceId) : undefined;
    const row = merged.get(key) ?? {
      deviceId: r.deviceId,
      deviceName: device ? (device.deviceName ?? device.deviceIdentifier) : "Unknown terminal",
      deviceIdentifier: device?.deviceIdentifier ?? null,
      salesTotal: 0,
      salesCount: 0,
      ordersTotal: 0,
      ordersCount: 0,
    };
    row.salesTotal += r._sum.total ?? 0;
    row.salesCount += r._count;
    merged.set(key, row);
  }
  for (const r of orderRows) {
    const key = r.deviceId ?? "unattributed";
    const device = r.deviceId ? deviceById.get(r.deviceId) : undefined;
    const row = merged.get(key) ?? {
      deviceId: r.deviceId,
      deviceName: device ? (device.deviceName ?? device.deviceIdentifier) : "Unknown terminal",
      deviceIdentifier: device?.deviceIdentifier ?? null,
      salesTotal: 0,
      salesCount: 0,
      ordersTotal: 0,
      ordersCount: 0,
    };
    row.ordersTotal += r._sum.total ?? 0;
    row.ordersCount += r._count;
    merged.set(key, row);
  }

  return Array.from(merged.values()).sort((a, b) => b.salesTotal - a.salesTotal);
}

/** Active POS terminals for a set of restaurants: device token used in the
 *  last 24h (lastSeenAt is refreshed on every authenticated sync call). */
export async function getActiveTerminals(opts: { restaurantIds: string[] }) {
  if (opts.restaurantIds.length === 0) return [];
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  return db.device.findMany({
    where: { restaurantId: { in: opts.restaurantIds }, status: "ACTIVE", lastSeenAt: { gte: since } },
    select: {
      id: true,
      deviceName: true,
      deviceIdentifier: true,
      lastSeenAt: true,
      restaurant: { select: { id: true, name: true } },
    },
    orderBy: { lastSeenAt: "desc" },
  });
}
