import { NextRequest } from "next/server";
import { ok, handler } from "@/lib/api";
import { requireClientApi } from "@/lib/auth/guards";
import { getClientDevicesScoped } from "@/lib/services/restaurants";

/** GET /api/client/devices — the caller's POS terminals only. */
export const GET = handler(async (_req: NextRequest) => {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const devices = await getClientDevicesScoped(auth.user.clientId!);
  return ok({
    devices: devices.map((d) => ({
      id: d.id,
      identifier: d.deviceIdentifier,
      name: d.deviceName,
      osInfo: d.osInfo,
      appVersion: d.appVersion,
      status: d.status,
      activatedAt: d.activatedAt,
      lastSeenAt: d.lastSeenAt,
      restaurant: d.restaurant.name,
      licenseKey: d.license.licenseKey,
    })),
  });
});
