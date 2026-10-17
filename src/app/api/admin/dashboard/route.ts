import { NextRequest } from "next/server";
import { ok, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import {
  getAdminOverview,
  getAdminOrderTrend,
  getAdminPaymentOrdersSplit,
  getTopRestaurants,
} from "@/lib/services/dashboard";

/** GET /api/admin/dashboard — platform KPIs for the admin overview.
 *  Order counts only — client revenue never leaves the server for admins. */
export const GET = handler(async (_req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const [overview, trend, paymentSplit, topRestaurants] = await Promise.all([
    getAdminOverview(),
    getAdminOrderTrend(14),
    getAdminPaymentOrdersSplit(),
    getTopRestaurants(5),
  ]);
  return ok({ overview, trend, paymentSplit, topRestaurants });
});
