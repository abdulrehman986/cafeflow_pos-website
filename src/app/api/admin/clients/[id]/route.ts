import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { updateClientSchema } from "@/lib/validators";
import { getClientDetail } from "@/lib/services/clients";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const detail = await getClientDetail(id);
  if (!detail) return fail("NOT_FOUND", "Client not found.");
  return ok(detail);
});

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const client = await db.client.findUnique({ where: { id } });
  if (!client) return fail("NOT_FOUND", "Client not found.");

  if (parsed.data.email && parsed.data.email !== client.email) {
    const clash = await db.client.findUnique({ where: { email: parsed.data.email } });
    if (clash) return fail("CONFLICT", "Another client already uses this email.");
  }

  const updated = await db.client.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
      ...(parsed.data.companyName !== undefined ? { companyName: parsed.data.companyName } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
  });

  // Keep the linked login account in sync (email / status)
  const profileUpdates: Record<string, unknown> = {};
  if (parsed.data.email !== undefined) profileUpdates.email = parsed.data.email;
  if (parsed.data.name !== undefined) profileUpdates.fullName = parsed.data.name;
  if (parsed.data.phone !== undefined) profileUpdates.phone = parsed.data.phone || null;
  if (parsed.data.status === "SUSPENDED" || parsed.data.status === "DEACTIVATED") {
    profileUpdates.isActive = false;
  } else if (parsed.data.status === "ACTIVE") {
    profileUpdates.isActive = true;
  }
  if (Object.keys(profileUpdates).length) {
    await db.profile.updateMany({ where: { clientId: id }, data: profileUpdates });
  }

  return ok({ client: updated, message: "Client updated." });
});

export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const client = await db.client.findUnique({
    where: { id },
    include: { _count: { select: { restaurants: true } } },
  });
  if (!client) return fail("NOT_FOUND", "Client not found.");
  if (client._count.restaurants > 0) {
    return fail(
      "CONFLICT",
      "This client still owns restaurants. Deactivate the client instead — hard delete is blocked while historical sales data exists."
    );
  }

  await db.profile.deleteMany({ where: { clientId: id } });
  await db.client.delete({ where: { id } });
  return ok({ message: "Client deleted." });
});
