import { NextRequest } from "next/server";
import { ok, handler } from "@/lib/api";
import { requireClientApi } from "@/lib/auth/guards";
import { getClientLicensesScoped } from "@/lib/services/restaurants";
import { licenseEffectiveStatus } from "@/lib/license-key";

/** GET /api/client/licenses — the caller's restaurant licenses only. */
export const GET = handler(async (_req: NextRequest) => {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const licenses = await getClientLicensesScoped(auth.user.clientId!);
  return ok({
    licenses: licenses.map((l) => {
      const eff = licenseEffectiveStatus(l);
      return {
        id: l.id,
        licenseKey: l.licenseKey,
        status: eff.effectiveStatus,
        restaurant: l.restaurant.name,
        restaurantId: l.restaurant.id,
        maxDevices: l.maxDevices,
        activatedAt: l.activatedAt,
        expiresAt: l.expiresAt,
        daysRemaining: eff.daysRemaining,
        lastVerifiedAt: l.lastVerifiedAt,
        devices: l.devices.map((d) => ({
          id: d.id,
          identifier: d.deviceIdentifier,
          name: d.deviceName,
          status: d.status,
          activatedAt: d.activatedAt,
          lastSeenAt: d.lastSeenAt,
        })),
      };
    }),
  });
});
