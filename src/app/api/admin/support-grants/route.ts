import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { supportGrantSchema } from "@/lib/validators";
import { createSupportGrant, revokeSupportGrant } from "@/lib/services/support";
import { db } from "@/lib/db";

/** Create a time-boxed support grant for one client (reason required). */
export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = supportGrantSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const client = await db.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true },
  });
  if (!client) return fail("NOT_FOUND", "Client not found.");

  const grant = await createSupportGrant({
    adminProfileId: auth.user.profileId,
    adminEmail: auth.user.email,
    clientId: parsed.data.clientId,
    reason: parsed.data.reason,
    hours: parsed.data.hours,
  });

  return ok({ grant });
});

/** Revoke an active support grant. */
export const DELETE = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const grantId = url.searchParams.get("id");
  if (!grantId) return fail("VALIDATION_ERROR", "Grant id is required.");

  const revoked = await revokeSupportGrant({
    grantId,
    adminProfileId: auth.user.profileId,
    adminEmail: auth.user.email,
  });
  if (!revoked) return fail("NOT_FOUND", "Grant not found.");

  return ok({ message: "Support access revoked." });
});
