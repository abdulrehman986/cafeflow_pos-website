import { db } from "@/lib/db";
import { startOfDayUTC } from "@/lib/format";

/** Admin: paginated client list with search + status filter. */
export async function listClients(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}) {
  const where = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search } },
            { companyName: { contains: opts.search } },
            { email: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        _count: { select: { restaurants: true } },
        restaurants: {
          where: { status: { not: "DEACTIVATED" } },
          select: { id: true, licenses: { where: { status: { not: "REVOKED" } }, select: { status: true, expiresAt: true } } },
        },
      },
    }),
    db.client.count({ where }),
  ]);

  const items = rows.map((c) => {
    const licenses = c.restaurants.flatMap((r) => r.licenses);
    const active = licenses.filter(
      (l) => l.status === "ACTIVE" && l.expiresAt > new Date()
    ).length;
    const expiring = licenses.filter(
      (l) => l.status === "ACTIVE" &&
        l.expiresAt > new Date() &&
        l.expiresAt < new Date(Date.now() + 30 * 86400000)
    ).length;
    const expired = licenses.filter(
      (l) => l.status === "EXPIRED" || (l.status === "ACTIVE" && l.expiresAt < new Date())
    ).length;
    return {
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      email: c.email,
      phone: c.phone,
      status: c.status,
      createdAt: c.createdAt,
      restaurantCount: c._count.restaurants,
      licenseCount: licenses.length,
      activeLicenses: active,
      expiringLicenses: expiring,
      expiredLicenses: expired,
    };
  });

  return { items, total, page: opts.page, pageSize: opts.pageSize };
}

export interface ClientDetail {
  client: {
    id: string; name: string; email: string; phone: string | null; companyName: string;
    status: string; notes: string | null; createdAt: Date;
  };
  restaurants: Array<{
    id: string; name: string; city: string | null; status: string; createdAt: Date;
    license: { id: string; licenseKey: string; status: string; expiresAt: Date; maxDevices: number; activatedAt: Date | null; lastVerifiedAt: Date | null } | null;
    deviceCount: number; activeDevices: number;
    todaySales: number; monthSales: number; totalOrders: number; lastSyncAt: Date | null;
  }>;
  devices: Array<{
    id: string; deviceIdentifier: string; deviceName: string | null; status: string;
    restaurant: string; licenseKey: string; activatedAt: Date; lastSeenAt: Date | null;
  }>;
  salesSummary: { today: number; month: number; total: number; last30: number; orderCount: number };
  accounts: Array<{ id: string; email: string; fullName: string; lastLoginAt: Date | null; isActive: boolean }>;
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return null;

  const todayStart = startOfDayUTC(new Date());
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const d30 = new Date(Date.now() - 30 * 86400000);

  const restaurants = await db.restaurant.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: {
      licenses: { where: { status: { not: "REVOKED" } }, orderBy: { createdAt: "desc" }, take: 1 },
      devices: { select: { id: true, status: true } },
      syncLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  // Aggregate sales metrics in SQL — client detail must never load raw
  // transaction rows (admin sees aggregates only, and rows scale unbounded).
  const restaurantIds = restaurants.map((r) => r.id);
  const salesAgg = restaurantIds.length
    ? await db.sale.groupBy({
        by: ["restaurantId"],
        where: { restaurantId: { in: restaurantIds }, status: "COMPLETED" },
        _sum: { total: true },
        _count: true,
      })
    : [];
  const [todayAgg, monthAgg, d30Agg, totalAgg] = await Promise.all([
    restaurantIds.length
      ? db.sale.groupBy({
          by: ["restaurantId"],
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: todayStart } },
          _sum: { total: true },
        })
      : Promise.resolve([] as Array<{ restaurantId: string; _sum: { total: number | null } }>),
    restaurantIds.length
      ? db.sale.groupBy({
          by: ["restaurantId"],
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: monthStart } },
          _sum: { total: true },
        })
      : Promise.resolve([] as Array<{ restaurantId: string; _sum: { total: number | null } }>),
    restaurantIds.length
      ? db.sale.groupBy({
          by: ["restaurantId"],
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: d30 } },
          _sum: { total: true },
        })
      : Promise.resolve([] as Array<{ restaurantId: string; _sum: { total: number | null } }>),
    restaurantIds.length
      ? db.order.groupBy({
          by: ["restaurantId"],
          where: { restaurantId: { in: restaurantIds } },
          _count: true,
        })
      : Promise.resolve([] as Array<{ restaurantId: string; _count: number }>),
  ]);

  const devices = await db.device.findMany({
    where: { restaurant: { clientId } },
    orderBy: { activatedAt: "desc" },
    include: { restaurant: { select: { name: true } }, license: { select: { licenseKey: true } } },
  });

  const accounts = await db.profile.findMany({
    where: { clientId },
    select: { id: true, email: true, fullName: true, lastLoginAt: true, isActive: true },
  });

  const lifetimeByRestaurant = new Map(salesAgg.map((r) => [r.restaurantId, r._sum.total ?? 0]));
  const todayByRestaurant = new Map(todayAgg.map((r) => [r.restaurantId, r._sum.total ?? 0]));
  const monthByRestaurant = new Map(monthAgg.map((r) => [r.restaurantId, r._sum.total ?? 0]));
  const d30ByRestaurant = new Map(d30Agg.map((r) => [r.restaurantId, r._sum.total ?? 0]));
  const ordersByRestaurant = new Map(totalAgg.map((r) => [r.restaurantId, r._count]));
  const sumOf = (m: Map<string, number>) => Array.from(m.values()).reduce((a, v) => a + v, 0);

  return {
    client: {
      id: client.id, name: client.name, email: client.email, phone: client.phone,
      companyName: client.companyName, status: client.status, notes: client.notes, createdAt: client.createdAt,
    },
    restaurants: restaurants.map((r) => {
      const license = r.licenses[0] ?? null;
      return {
        id: r.id, name: r.name, city: r.city, status: r.status, createdAt: r.createdAt,
        license: license
          ? {
              id: license.id, licenseKey: license.licenseKey, status: license.status,
              expiresAt: license.expiresAt, maxDevices: license.maxDevices,
              activatedAt: license.activatedAt, lastVerifiedAt: license.lastVerifiedAt,
            }
          : null,
        deviceCount: r.devices.length,
        activeDevices: r.devices.filter((d) => d.status === "ACTIVE").length,
        todaySales: todayByRestaurant.get(r.id) ?? 0,
        monthSales: monthByRestaurant.get(r.id) ?? 0,
        totalOrders: ordersByRestaurant.get(r.id) ?? 0,
        lastSyncAt: r.syncLogs[0]?.createdAt ?? null,
      };
    }),
    devices: devices.map((d) => ({
      id: d.id, deviceIdentifier: d.deviceIdentifier, deviceName: d.deviceName, status: d.status,
      restaurant: d.restaurant.name, licenseKey: d.license.licenseKey,
      activatedAt: d.activatedAt, lastSeenAt: d.lastSeenAt,
    })),
    salesSummary: {
      today: sumOf(todayByRestaurant),
      month: sumOf(monthByRestaurant),
      total: sumOf(lifetimeByRestaurant),
      last30: sumOf(d30ByRestaurant),
      orderCount: Array.from(ordersByRestaurant.values()).reduce((a, v) => a + v, 0),
    },
    accounts,
  };
}
