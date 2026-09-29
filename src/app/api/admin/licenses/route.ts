import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { generateLicenseSchema, paginationSchema } from "@/lib/validators";
import { listLicenses } from "@/lib/services/restaurants";
import { generateLicenseForRestaurant, LicenseError } from "@/lib/services/licenses";

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? 10,
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid pagination parameters.");

  const result = await listLicenses({
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
  const parsed = generateLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const license = await generateLicenseForRestaurant({
      restaurantId: parsed.data.restaurantId,
      maxDevices: parsed.data.maxDevices,
      expiresInMonths: parsed.data.expiresInMonths,
    });
    return ok({ license }, { status: 201 });
  } catch (e) {
    if (e instanceof LicenseError) return fail(e.code as never, e.message);
    throw e;
  }
});
