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

export async function listShifts(opts: {
  restaurantIds: string[];
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  restaurantId?: string;
}) {
  const scope = opts.restaurantId
    ? { restaurantId: opts.restaurantId }
    : { restaurantId: { in: opts.restaurantIds } };
  const where = {
    ...scope,
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
