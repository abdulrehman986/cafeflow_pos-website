import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { createRestaurantSchema, paginationSchema } from "@/lib/validators";
import { listRestaurants } from "@/lib/services/restaurants";
import { db } from "@/lib/db";

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? 10,
  });
  if (!parsed.success)
    return fail("VALIDATION_ERROR", "Invalid pagination parameters.");

  const result = await listRestaurants({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    search: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    clientId: url.searchParams.get("clientId") ?? undefined,
  });
  return ok(result);
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }
  const input = parsed.data;

  const client = await db.client.findUnique({ where: { id: input.clientId } });
  if (!client) return fail("NOT_FOUND", "Client not found.");
  if (client.status !== "ACTIVE") {
    return fail("CONFLICT", "Cannot add a restaurant to a non-active client.");
  }

  const restaurant = await db.restaurant.create({
    data: {
      clientId: input.clientId,
      name: input.name,
      city: input.city || null,
      address: input.address || null,
      phone: input.phone || null,
      status: "ACTIVE",
    },
  });

  return ok({ restaurant, license: null }, { status: 201 });
});
