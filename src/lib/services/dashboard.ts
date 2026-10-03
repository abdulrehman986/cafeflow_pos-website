import { db } from "@/lib/db";
import { refreshExpiredLicenses, licenseBucket } from "./licenses";
import { startOfDayUTC, addDays } from "@/lib/format";

// ─────────────────────── Admin dashboard ───────────────────────

export async function getAdminOverview() {
  await refreshExpiredLicenses();

  const now = new Date();
  const todayStart = startOfDayUTC(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    totalClients,
    activeClients,
    suspendedClients,
    totalRestaurants,
    activeRestaurants,
    licenses,
    todaySalesAgg,
    monthSalesAgg,
  ] = await Promise.all([
    db.client.count(),
    db.client.count({ where: { status: "ACTIVE" } }),
    db.client.count({ where: { status: "SUSPENDED" } }),
    db.restaurant.count(),
    db.restaurant.count({ where: { status: "ACTIVE" } }),
    db.license.findMany({
      where: { status: { not: "REVOKED" } },
      select: { status: true, expiresAt: true },
    }),
    db.sale.aggregate({
      where: { status: "COMPLETED", saleDate: { gte: todayStart } },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { status: "COMPLETED", saleDate: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const buckets = { ACTIVE: 0, EXPIRING_SOON: 0, EXPIRED: 0, SUSPENDED: 0, PENDING: 0 };
  for (const l of licenses) {
    const bucket = licenseBucket(l.status, l.expiresAt);
    if (bucket in buckets) buckets[bucket as keyof typeof buckets]++;
  }

  return {
    clients: { total: totalClients, active: activeClients, suspended: suspendedClients },
    restaurants: { total: totalRestaurants, active: activeRestaurants },
    licenses: {
      active: buckets.ACTIVE,
      expiringSoon: buckets.EXPIRING_SOON,
      expired: buckets.EXPIRED,
      suspended: buckets.SUSPENDED,
      pending: buckets.PENDING,
      total: licenses.length,
    },
    sales: {
      today: todaySalesAgg._sum.total ?? 0,
      todayOrders: todaySalesAgg._count,
      month: monthSalesAgg._sum.total ?? 0,
      monthOrders: monthSalesAgg._count,
    },
  };
}

/** 14-day platform revenue trend for the admin chart. */
export async function getAdminSalesTrend(days = 14) {
  const start = addDays(startOfDayUTC(new Date()), -(days - 1));
  const sales = await db.sale.findMany({
    where: { status: "COMPLETED", saleDate: { gte: start } },
    select: { saleDate: true, total: true, restaurantId: true },
  });
  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of sales) {
    const key = s.saleDate.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + s.total);
  }
  return Array.from(byDay.entries()).map(([date, total]) => ({ date, total }));
}

/** Revenue split by payment method (admin overview donut). */
export async function getAdminPaymentSplit() {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const rows = await db.sale.groupBy({
    by: ["paymentMethod"],
    where: { status: "COMPLETED", saleDate: { gte: monthStart } },
    _sum: { total: true },
    _count: true,
  });
  return rows
    .filter((r) => r.paymentMethod)
    .map((r) => ({
      method: r.paymentMethod as string,
      total: r._sum.total ?? 0,
      count: r._count,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Top restaurants by revenue this month. */
export async function getTopRestaurants(limit = 6) {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const rows = await db.sale.groupBy({
    by: ["restaurantId"],
    where: { status: "COMPLETED", saleDate: { gte: monthStart } },
    _sum: { total: true },
    _count: true,
  });
  const ids = rows.map((r) => r.restaurantId);
  const restaurants = ids.length
    ? await db.restaurant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, client: { select: { companyName: true } } } })
    : [];
  const nameById = new Map(restaurants.map((r) => [r.id, r]));
  return rows
    .map((r) => ({
      name: nameById.get(r.restaurantId)?.name ?? "Unknown",
      client: nameById.get(r.restaurantId)?.client.companyName ?? "—",
      total: r._sum.total ?? 0,
      orders: r._count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ─────────────────────── Client dashboard ───────────────────────

export async function getClientOverview(clientId: string) {
  await refreshExpiredLicenses();

  const now = new Date();
  const todayStart = startOfDayUTC(now);
  const weekStart = addDays(todayStart, -6);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const restaurants = await db.restaurant.findMany({
    where: { clientId },
    select: { id: true, name: true, status: true, city: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const restaurantIds = restaurants.map((r) => r.id);

  const [todayAgg, weekAgg, monthAgg, todayOrders, licenses] = await Promise.all([
    restaurantIds.length
      ? db.sale.aggregate({
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: todayStart } },
          _sum: { total: true },
        })
      : Promise.resolve({ _sum: { total: 0 } }),
    restaurantIds.length
      ? db.sale.aggregate({
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: weekStart } },
          _sum: { total: true },
        })
      : Promise.resolve({ _sum: { total: 0 } }),
    restaurantIds.length
      ? db.sale.aggregate({
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: monthStart } },
          _sum: { total: true },
        })
      : Promise.resolve({ _sum: { total: 0 } }),
    restaurantIds.length
      ? db.sale.count({
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: todayStart } },
        })
      : Promise.resolve(0),
    db.license.findMany({
      where: { restaurant: { clientId }, status: { not: "REVOKED" } },
      select: { status: true, expiresAt: true, restaurantId: true, licenseKey: true, id: true },
    }),
  ]);

  let activeLicenses = 0;
  let expiringLicenses = 0;
  let expiredLicenses = 0;
  let suspendedLicenses = 0;
  for (const l of licenses) {
    const bucket = licenseBucket(l.status, l.expiresAt);
    if (bucket === "ACTIVE") activeLicenses++;
    else if (bucket === "EXPIRING_SOON") { expiringLicenses++; activeLicenses++; }
    else if (bucket === "EXPIRED") expiredLicenses++;
    else if (bucket === "SUSPENDED") suspendedLicenses++;
  }

  // Per-restaurant today numbers for the restaurant cards
  const todayByRestaurant = restaurantIds.length
    ? await db.sale.groupBy({
        by: ["restaurantId"],
        where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: todayStart } },
        _sum: { total: true },
        _count: true,
      })
    : [];
  const todayMap = new Map(todayByRestaurant.map((r) => [r.restaurantId, { total: r._sum.total ?? 0, count: r._count }]));

  const licenseByRestaurant = new Map(licenses.map((l) => [l.restaurantId, l]));

  const restaurantCards = restaurants.map((r) => {
    const license = licenseByRestaurant.get(r.id);
    const bucket = license ? licenseBucket(license.status, license.expiresAt) : "NONE";
    return {
      id: r.id,
      name: r.name,
      city: r.city,
      status: r.status,
      todaySales: todayMap.get(r.id)?.total ?? 0,
      todayOrders: todayMap.get(r.id)?.count ?? 0,
      licenseStatus: bucket,
      licenseExpiresAt: license?.expiresAt ?? null,
      licenseDaysRemaining: license
        ? Math.max(0, Math.ceil((license.expiresAt.getTime() - now.getTime()) / 86400000))
        : null,
    };
  });

  return {
    client: { restaurantCount: restaurants.length, activeRestaurantCount: restaurants.filter((r) => r.status === "ACTIVE").length },
    sales: {
      today: todayAgg._sum.total ?? 0,
      week: weekAgg._sum.total ?? 0,
      month: monthAgg._sum.total ?? 0,
      todayOrders,
    },
    licenses: {
      active: activeLicenses,
      expiringSoon: expiringLicenses,
      expired: expiredLicenses,
      suspended: suspendedLicenses,
    },
    restaurants: restaurantCards,
  };
}

/** Daily sales series for one restaurant (or a client's whole estate). */
export async function getSalesSeries(opts: {
  restaurantIds: string[];
  from: Date;
  to: Date;
}) {
  const sales = await db.sale.findMany({
    where: {
      restaurantId: { in: opts.restaurantIds },
      status: "COMPLETED",
      saleDate: { gte: opts.from, lte: opts.to },
    },
    select: { saleDate: true, total: true },
  });
  const byDay = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    const key = s.saleDate.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { total: 0, count: 0 };
    cur.total += s.total;
    cur.count += 1;
    byDay.set(key, cur);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, total: v.total, orders: v.count }));
}

/** Payment-method split for a set of restaurants. */
export async function getPaymentSplit(opts: { restaurantIds: string[]; from?: Date; to?: Date }) {
  const rows = await db.sale.groupBy({
    by: ["paymentMethod"],
    where: {
      restaurantId: { in: opts.restaurantIds },
      status: "COMPLETED",
      ...(opts.from || opts.to
        ? { saleDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
    },
    _sum: { total: true },
    _count: true,
  });
  return rows
    .filter((r) => r.paymentMethod)
    .map((r) => ({ method: r.paymentMethod as string, total: r._sum.total ?? 0, count: r._count }))
    .sort((a, b) => b.total - a.total);
}

/** Paginated sales list with filters. restaurantIds scopes the query (security boundary). */
export async function listSales(opts: {
  restaurantIds: string[];
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  paymentMethod?: string;
  search?: string;
}) {
  const where = {
    restaurantId: { in: opts.restaurantIds },
    ...(opts.from || opts.to
      ? { saleDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
      : {}),
    ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
    ...(opts.search
      ? {
          OR: [
            { saleNumber: { contains: opts.search } },
            { localSaleId: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total, sum] = await Promise.all([
    db.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: { restaurant: { select: { name: true } } },
    }),
    db.sale.count({ where }),
    db.sale.aggregate({ where, _sum: { total: true } }),
  ]);
  return { rows, total, sum: sum._sum.total ?? 0, page: opts.page, pageSize: opts.pageSize };
}

/** Paginated orders list with filters. */
export async function listOrders(opts: {
  restaurantIds: string[];
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  status?: string;
  search?: string;
}) {
  const where = {
    restaurantId: { in: opts.restaurantIds },
    ...(opts.from || opts.to
      ? { orderDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
      : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search
      ? { OR: [{ orderNumber: { contains: opts.search } }, { localOrderId: { contains: opts.search } }] }
      : {}),
  };
  const [rows, total, sum] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { orderDate: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: { restaurant: { select: { name: true } }, _count: { select: { items: true } } },
    }),
    db.order.count({ where }),
    db.order.aggregate({ where, _sum: { total: true } }),
  ]);
  return { rows, total, sum: sum._sum.total ?? 0, page: opts.page, pageSize: opts.pageSize };
}

// ─────────────────────── POS terminal sync (shifts / refunds / expenses) ───────────────────────
// Data uploaded by the desktop POS via /api/pos/{shifts,refunds,expenses}/sync.

export async function getPosSyncOverview() {
  const [shifts, refunds, expenses, lastShift, lastRefund, lastExpense] =
    await Promise.all([
      db.shift.count(),
      db.refund.count(),
      db.expense.count(),
      db.shift.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
      db.refund.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
      db.expense.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
    ]);
  const lastSyncedAt =
    [lastShift?.syncedAt, lastRefund?.syncedAt, lastExpense?.syncedAt]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { shifts, refunds, expenses, lastSyncedAt };
}

export async function listRecentShifts(limit = 6) {
  return db.shift.findMany({
    orderBy: { closedAt: "desc" },
    take: limit,
    include: { restaurant: { select: { name: true } } },
  });
}

export async function listRecentRefunds(limit = 6) {
  return db.refund.findMany({
    orderBy: { refundedAt: "desc" },
    take: limit,
    include: { restaurant: { select: { name: true } } },
  });
}

export async function listRecentExpenses(limit = 6) {
  return db.expense.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { restaurant: { select: { name: true } } },
  });
}
