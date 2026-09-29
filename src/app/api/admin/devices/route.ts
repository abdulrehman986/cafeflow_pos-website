import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { updateDeviceSchema, paginationSchema } from "@/lib/validators";
import { listDevices } from "@/lib/services/restaurants";
import { db } from "@/lib/db";

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? 10,
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid pagination parameters.");

  const result = await listDevices({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    search: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    clientId: url.searchParams.get("clientId") ?? undefined,
  });
  return ok(result);
});

export const PATCH = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = updateDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("id");
  if (!deviceId) return fail("VALIDATION_ERROR", "Device id is required.");

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) return fail("NOT_FOUND", "Device not found.");

  const updated = await db.device.update({
    where: { id: deviceId },
    data: { status: parsed.data.status },
  });

  const messages: Record<string, string> = {
    ACTIVE: "Device reactivated.",
    BLOCKED: "Device blocked — its token no longer authenticates.",
    DEACTIVATED: "Device deactivated. The device slot is now free for a new activation.",
  };
  return ok({ device: updated, message: messages[parsed.data.status] });
});
