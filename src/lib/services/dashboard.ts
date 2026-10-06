import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { refreshExpiredLicenses, licenseBucket } from "./licenses";
import { startOfDayUTC, addDays } from "@/lib/format";
import { LICENSE_EXPIRING_SOON_DAYS } from "@/lib/constants";

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
    licenseBuckets,
    todaySalesAgg,
    monthSalesAgg,
  ] = await Promise.all([
    db.client.count(),
    db.client.count({ where: { status: "ACTIVE" } }),
    db.client.count({ where: { status: "SUSPENDED" } }),
    db.restaurant.count(),
    db.restaurant.count({ where: { status: "ACTIVE" } }),
    // Bucket counts computed in SQL instead of loading every license row
    // (ACTIVE licenses past expiry were already flipped by refreshExpiredLicenses).
    // UTC_TIMESTAMP() matches how Prisma stores DateTime (UTC) on MySQL/TiDB.
    db.$queryRaw<{
      total: bigint;
      active: bigint;
      expiring_soon: bigint;
      expired: bigint;
      suspended: bigint;
      pending: bigint;
    }[]>`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'ACTIVE' AND expiresAt < UTC_TIMESTAMP() + INTERVAL ${LICENSE_EXPIRING_SOON_DAYS} DAY THEN 1 ELSE 0 END) AS expiring_soon,
        SUM(CASE WHEN status = 'EXPIRED' OR (status = 'ACTIVE' AND expiresAt < UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspended,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending
      FROM licenses
      WHERE status <> 'REVOKED'`,
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

  const b = licenseBuckets[0];
  const buckets = {
    ACTIVE: Number(b?.active ?? 0),
    EXPIRING_SOON: Number(b?.expiring_soon ?? 0),
    EXPIRED: Number(b?.expired ?? 0),
    SUSPENDED: Number(b?.suspended ?? 0),
    PENDING: Number(b?.pending ?? 0),
  };

  return {
    clients: { total: totalClients, active: activeClients, suspended: suspendedClients },
    restaurants: { total: totalRestaurants, active: activeRestaurants },
    licenses: {
      active: buckets.ACTIVE,
      expiringSoon: buckets.EXPIRING_SOON,
      expired: buckets.EXPIRED,
      suspended: buckets.SUSPENDED,
      pending: buckets.PENDING,
      total: Number(b?.total ?? 0),
    },
    sales: {
      today: todaySalesAgg._sum.total ?? 0,
      todayOrders: todaySalesAgg._count,
      month: monthSalesAgg._sum.total ?? 0,
      monthOrders: monthSalesAgg._count,
    },
  };
}

/** 14-day platform revenue trend for the admin chart.
 *  Aggregated in SQL (one row per day) — never ships raw sale rows to Node. */
export async function getAdminSalesTrend(days = 14) {
  const start = addDays(startOfDayUTC(new Date()), -(days - 1));
  const rows = await db.$queryRaw<{ day: string; total: number }[]>`
    SELECT DATE_FORMAT(saleDate, '%Y-%m-%d') AS day, SUM(total) AS total
    FROM sales
    WHERE status = 'COMPLETED' AND saleDate >= ${start}
    GROUP BY day`;
  const totals = new Map(rows.map((r) => [r.day, Number(r.total)]));
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(start, i).toISOString().slice(0, 10);
    return { date: key, total: totals.get(key) ?? 0 };
  });
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

/** Top clients by revenue over the trailing `days` (reports ranking).
 *  One SQL aggregation — replaces loading every 30-day sale row into Node. */
export async function getTopClientsByRevenue(days = 30, limit = 10) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await db.$queryRaw<{ id: string; companyName: string; revenue: number }[]>`
    SELECT c.id, c.companyName, SUM(s.total) AS revenue
    FROM clients c
    JOIN restaurants r ON r.clientId = c.id
    JOIN sales s ON s.restaurantId = r.id
      AND s.status = 'COMPLETED' AND s.saleDate >= ${since}
    GROUP BY c.id, c.companyName
    HAVING SUM(s.total) > 0
    ORDER BY revenue DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, name: r.companyName, revenue: Number(r.revenue) }));
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

/** Daily sales series for one restaurant (or a client's whole estate).
 *  Aggregated in SQL (one row per day) — never ships raw sale rows to Node. */
export async function getSalesSeries(opts: {
  restaurantIds: string[];
  from: Date;
  to: Date;
}) {
  if (opts.restaurantIds.length === 0) return [];
  const rows = await db.$queryRaw<{ day: string; total: number; orders: bigint | number }[]>`
    SELECT DATE_FORMAT(saleDate, '%Y-%m-%d') AS day, SUM(total) AS total, COUNT(*) AS orders
    FROM sales
    WHERE status = 'COMPLETED'
      AND saleDate >= ${opts.from} AND saleDate <= ${opts.to}
      AND restaurantId IN (${Prisma.join(opts.restaurantIds)})
    GROUP BY day`;
  return rows
    .map((r) => ({ date: r.day, total: Number(r.total), orders: Number(r.orders) }))
    .sort((a, b) => a.date.localeCompare(b.date));
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

/** Paginated sales list with filters.
 *  `restaurantIds` scopes the query (security boundary for client users);
 *  omit it for platform-wide listings (admin) — no giant IN(...) clause. */
export async function listSales(opts: {
  restaurantIds?: string[];
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  paymentMethod?: string;
  search?: string;
}) {
  const where = {
    ...(opts.restaurantIds?.length ? { restaurantId: { in: opts.restaurantIds } } : {}),
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

/** Paginated orders list with filters. Same scoping rules as listSales. */
export async function listOrders(opts: {
  restaurantIds?: string[];
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  status?: string;
  search?: string;
}) {
  const where = {
    ...(opts.restaurantIds?.length ? { restaurantId: { in: opts.restaurantIds } } : {}),
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

// ─────────────────────── POS terminal sync (shifts / expenses) ───────────────────────
// Aggregate metrics for the admin dashboard. The admin never sees individual
// shift/expense rows — cash-drawer detail is only visible to the owning
// client (and to audited support grants).

export async function getPosSyncOverview() {
  const [shifts, expenses, lastShift, lastExpense] = await Promise.all([
    db.shift.count(),
    db.expense.count(),
    db.shift.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
    db.expense.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
  ]);
  const lastSyncedAt =
    [lastShift?.syncedAt, lastExpense?.syncedAt]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { shifts, expenses, lastSyncedAt };
}

/** Terminal activity counts for the admin dashboard: active POS terminals
 *  (device token used in the last 24h) and records synced in the last 24h.
 *  Counts only — no per-shift or per-expense rows leave the aggregate layer. */
export async function getAdminTerminalActivity() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [activeTerminals, totalTerminals, shifts24h, expenses24h] = await Promise.all([
    db.device.count({ where: { status: "ACTIVE", lastSeenAt: { gte: since } } }),
    db.device.count({ where: { status: "ACTIVE" } }),
    db.shift.count({ where: { syncedAt: { gte: since } } }),
    db.expense.count({ where: { syncedAt: { gte: since } } }),
  ]);
  return { activeTerminals, totalTerminals, shifts24h, expenses24h };
}
