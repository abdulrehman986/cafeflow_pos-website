import { NextRequest } from "next/server";
import { ok, handler } from "@/lib/api";
import { requireClientApi } from "@/lib/auth/guards";
import { getClientRestaurantsScoped, getClientLicensesScoped, getClientDevicesScoped } from "@/lib/services/restaurants";
import { licenseEffectiveStatus } from "@/lib/license-key";

/** GET /api/client/restaurants — the caller's restaurants only (server-scoped). */
export const GET = handler(async (_req: NextRequest) => {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const restaurants = await getClientRestaurantsScoped(auth.user.clientId!);
  return ok({
    restaurants: restaurants.map((r) => {
      const license = r.licenses[0] ?? null;
      const eff = license ? licenseEffectiveStatus(license) : null;
      return {
        id: r.id,
        name: r.name,
        city: r.city,
        status: r.status,
        createdAt: r.createdAt,
        license: license
          ? {
              key: license.licenseKey,
              status: eff!.effectiveStatus,
              expiresAt: license.expiresAt,
              daysRemaining: eff!.daysRemaining,
              maxDevices: license.maxDevices,
            }
          : null,
        devices: r.devices.map((d) => ({
          id: d.id,
          identifier: d.deviceIdentifier,
          name: d.deviceName,
          status: d.status,
          lastSeenAt: d.lastSeenAt,
        })),
      };
    }),
    licenses: (await getClientLicensesScoped(auth.user.clientId!)).length,
    devices: (await getClientDevicesScoped(auth.user.clientId!)).length,
  });
});
