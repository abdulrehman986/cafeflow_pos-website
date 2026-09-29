import { db } from "@/lib/db";

/** Admin: paginated restaurant list with client info + license snapshot. */
export async function listRestaurants(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  clientId?: string;
}) {
  const where = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
    ...(opts.search
      ? { OR: [{ name: { contains: opts.search } }, { city: { contains: opts.search } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.restaurant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        client: { select: { companyName: true, name: true } },
        licenses: { where: { status: { not: "REVOKED" } }, orderBy: { createdAt: "desc" }, take: 1 },
        devices: { select: { status: true } },
      },
    }),
    db.restaurant.count({ where }),
  ]);

  const items = rows.map((r) => {
    const license = r.licenses[0] ?? null;
    return {
      id: r.id,
      name: r.name,
      city: r.city,
      status: r.status,
      createdAt: r.createdAt,
      clientName: r.client.companyName,
      clientId: r.clientId,
      licenseKey: license?.licenseKey ?? null,
      licenseStatus: license?.status ?? "NONE",
      licenseExpiresAt: license?.expiresAt ?? null,
      maxDevices: license?.maxDevices ?? 0,
      activeDevices: r.devices.filter((d) => d.status === "ACTIVE").length,
    };
  });
  return { items, total, page: opts.page, pageSize: opts.pageSize };
}

/** Admin: license list with filters. */
export async function listLicenses(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  clientId?: string;
}) {
  const where = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.clientId ? { restaurant: { clientId: opts.clientId } } : {}),
    ...(opts.search ? { licenseKey: { contains: opts.search.toUpperCase() } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.license.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        restaurant: { select: { name: true, client: { select: { companyName: true, id: true } } } },
        devices: { select: { status: true, deviceName: true, lastSeenAt: true, deviceIdentifier: true } },
      },
    }),
    db.license.count({ where }),
  ]);
  const items = rows.map((l) => ({
    id: l.id,
    licenseKey: l.licenseKey,
    status: l.status,
    maxDevices: l.maxDevices,
    activatedAt: l.activatedAt,
    expiresAt: l.expiresAt,
    lastVerifiedAt: l.lastVerifiedAt,
    createdAt: l.createdAt,
    restaurantId: l.restaurantId,
    restaurantName: l.restaurant.name,
    clientName: l.restaurant.client.companyName,
    clientId: l.restaurant.client.id,
    activeDevices: l.devices.filter((d) => d.status === "ACTIVE").length,
    devices: l.devices,
  }));
  return { items, total, page: opts.page, pageSize: opts.pageSize };
}

/** Admin: device list with filters. */
export async function listDevices(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  clientId?: string;
}) {
  const where = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.clientId ? { restaurant: { clientId: opts.clientId } } : {}),
    ...(opts.search
      ? {
          OR: [
            { deviceIdentifier: { contains: opts.search } },
            { deviceName: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.device.findMany({
      where,
      orderBy: { activatedAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        restaurant: { select: { name: true, client: { select: { companyName: true } } } },
        license: { select: { licenseKey: true, expiresAt: true, maxDevices: true } },
      },
    }),
    db.device.count({ where }),
  ]);
  const items = rows.map((d) => ({
    id: d.id,
    deviceIdentifier: d.deviceIdentifier,
    deviceName: d.deviceName,
    osInfo: d.osInfo,
    appVersion: d.appVersion,
    status: d.status,
    activatedAt: d.activatedAt,
    lastSeenAt: d.lastSeenAt,
    restaurantName: d.restaurant.name,
    clientName: d.restaurant.client.companyName,
    licenseKey: d.license.licenseKey,
  }));
  return { items, total, page: opts.page, pageSize: opts.pageSize };
}

/** Admin: restaurant detail (used by reports / drill-downs). */
export async function getRestaurantDetail(restaurantId: string) {
  return db.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      client: { select: { id: true, companyName: true, name: true, email: true, phone: true, status: true } },
      licenses: { orderBy: { createdAt: "desc" }, include: { devices: true } },
      devices: { orderBy: { activatedAt: "desc" } },
    },
  });
}

/** Client: restaurants with license + device info for /client pages. */
export async function getClientRestaurantsScoped(clientId: string) {
  return db.restaurant.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: {
      licenses: { where: { status: { not: "REVOKED" } }, orderBy: { createdAt: "desc" }, take: 1 },
      devices: { select: { id: true, deviceIdentifier: true, deviceName: true, status: true, lastSeenAt: true, activatedAt: true, osInfo: true, appVersion: true, license: { select: { licenseKey: true } } } },
    },
  });
}

/** Client: licenses for their restaurants only. */
export async function getClientLicensesScoped(clientId: string) {
  return db.license.findMany({
    where: { restaurant: { clientId }, status: { not: "REVOKED" } },
    orderBy: { expiresAt: "asc" },
    include: {
      restaurant: { select: { id: true, name: true, city: true } },
      devices: { select: { id: true, deviceIdentifier: true, deviceName: true, status: true, activatedAt: true, lastSeenAt: true, osInfo: true } },
    },
  });
}

/** Client: devices across their restaurants only. */
export async function getClientDevicesScoped(clientId: string) {
  return db.device.findMany({
    where: { restaurant: { clientId } },
    orderBy: { lastSeenAt: "desc" },
    include: {
      restaurant: { select: { name: true } },
      license: { select: { licenseKey: true, status: true, expiresAt: true, maxDevices: true } },
    },
  });
}
