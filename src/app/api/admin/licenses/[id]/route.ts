import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { updateLicenseSchema } from "@/lib/validators";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const input = parsed.data;

  if (input.expiresAt && input.extendMonths) {
    return fail("VALIDATION_ERROR", "Provide either expiresAt or extendMonths, not both.");
  }

  const license = await db.license.findUnique({ where: { id } });
  if (!license) return fail("NOT_FOUND", "License not found.");

  const data: Record<string, unknown> = {};
  if (input.status) {
    data.status = input.status;
    if (input.status === "ACTIVE" && !license.activatedAt) data.activatedAt = new Date();
  }
  if (input.maxDevices) {
    // Lowering below the active device count is rejected to avoid ambiguity
    if (input.maxDevices < license.maxDevices) {
      const activeDevices = await db.device.count({
        where: { licenseId: id, status: "ACTIVE" },
      });
      if (input.maxDevices < activeDevices) {
        return fail(
          "CONFLICT",
          `${activeDevices} devices are already active. Deactivate devices first or set a higher limit.`
        );
      }
    }
    data.maxDevices = input.maxDevices;
  }
  if (input.expiresAt) {
    const newExpiry = new Date(input.expiresAt);
    if (newExpiry <= new Date()) return fail("VALIDATION_ERROR", "Expiry must be in the future.");
    data.expiresAt = newExpiry;
  }
  if (input.extendMonths) {
    const base = license.expiresAt > new Date() ? license.expiresAt : new Date();
    const extended = new Date(base);
    extended.setMonth(extended.getMonth() + input.extendMonths);
    data.expiresAt = extended;
    // An extension naturally revives an EXPIRED license
    if (license.status === "EXPIRED") data.status = "ACTIVE";
  }

  const updated = await db.license.update({ where: { id }, data });
  return ok({ license: updated, message: "License updated." });
});
