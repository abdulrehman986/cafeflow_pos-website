import { NextRequest } from "next/server";
import { ok, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import {
  getAdminOverview,
  getAdminSalesTrend,
  getAdminPaymentSplit,
  getTopRestaurants,
} from "@/lib/services/dashboard";

/** GET /api/admin/dashboard — platform KPIs for the admin overview. */
export const GET = handler(async (_req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const [overview, trend, paymentSplit, topRestaurants] = await Promise.all([
    getAdminOverview(),
    getAdminSalesTrend(14),
    getAdminPaymentSplit(),
    getTopRestaurants(5),
  ]);
  return ok({ overview, trend, paymentSplit, topRestaurants });
});
