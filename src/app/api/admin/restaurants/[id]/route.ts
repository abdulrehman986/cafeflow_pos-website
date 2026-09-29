import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { updateRestaurantSchema } from "@/lib/validators";
import { getRestaurantDetail } from "@/lib/services/restaurants";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const restaurant = await getRestaurantDetail(id);
  if (!restaurant) return fail("NOT_FOUND", "Restaurant not found.");
  return ok({ restaurant });
});

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const existing = await db.restaurant.findUnique({ where: { id } });
  if (!existing) return fail("NOT_FOUND", "Restaurant not found.");

  const updated = await db.restaurant.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.city !== undefined ? { city: parsed.data.city || null } : {}),
      ...(parsed.data.address !== undefined ? { address: parsed.data.address || null } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
  });
  return ok({ restaurant: updated, message: "Restaurant updated." });
});

export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: { _count: { select: { sales: true, orders: true } } },
  });
  if (!restaurant) return fail("NOT_FOUND", "Restaurant not found.");
  if (restaurant._count.sales > 0 || restaurant._count.orders > 0) {
    // Historical sales exist → soft delete to preserve audit history
    await db.restaurant.update({ where: { id }, data: { status: "DEACTIVATED" } });
    return ok({ message: "Restaurant deactivated (has synced sales history)." });
  }
  await db.restaurant.delete({ where: { id } });
  return ok({ message: "Restaurant deleted." });
});
