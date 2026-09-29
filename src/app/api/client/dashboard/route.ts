import { NextRequest } from "next/server";
import { ok, handler } from "@/lib/api";
import { requireClientApi } from "@/lib/auth/guards";
import { getClientOverview, getSalesSeries } from "@/lib/services/dashboard";
import { startOfDayUTC, addDays } from "@/lib/format";

/** GET /api/client/dashboard — today/week/month stats + per-restaurant cards. */
export const GET = handler(async (_req: NextRequest) => {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const overview = await getClientOverview(auth.user.clientId!);
  const series = overview.restaurants.length
    ? await getSalesSeries({
        restaurantIds: overview.restaurants.map((r) => r.id),
        from: addDays(startOfDayUTC(new Date()), -29),
        to: new Date(),
      })
    : [];
  return ok({ ...overview, series });
});
