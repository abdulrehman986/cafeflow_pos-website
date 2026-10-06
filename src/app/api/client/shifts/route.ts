import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireClientApi } from "@/lib/auth/guards";
import { paginationSchema } from "@/lib/validators";
import { db } from "@/lib/db";
import { listShifts, getShiftDetail } from "@/lib/services/shifts";

/**
 * Client shifts — completed shift reconciliations for the logged-in owner.
 * GET                 → paginated list (all owned restaurants)
 * GET ?shiftId=...    → one shift with expenses + orders in its window
 */
export const GET = handler(async (req: NextRequest) => {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const restaurants = await db.restaurant.findMany({
    where: { clientId: auth.user.clientId! },
    select: { id: true },
  });
  const restaurantIds = restaurants.map((r) => r.id);

  const url = new URL(req.url);
  const shiftId = url.searchParams.get("shiftId");
  if (shiftId) {
    const detail = await getShiftDetail({ shiftId, restaurantIds });
    if (!detail) return fail("NOT_FOUND", "Shift not found.");
    return ok(detail);
  }

  const parsed = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? 10,
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid pagination parameters.");

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const result = await listShifts({
    restaurantIds,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    ...(from ? { from: new Date(from + "T00:00:00Z") } : {}),
    ...(to ? { to: new Date(to + "T23:59:59Z") } : {}),
    restaurantId: url.searchParams.get("restaurantId") ?? undefined,
  });
  return ok(result);
});
