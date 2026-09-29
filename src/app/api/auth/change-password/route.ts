import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validators";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const POST = handler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return fail("UNAUTHORIZED", "Authentication required.");

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const profile = await db.profile.findUnique({ where: { id: user.profileId } });
  if (!profile || !(await verifyPassword(parsed.data.currentPassword, profile.passwordHash))) {
    return fail("INVALID_CREDENTIALS", "Current password is incorrect.");
  }

  await db.profile.update({
    where: { id: user.profileId },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  return ok({ message: "Password changed successfully." });
});

export const PATCH = handler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return fail("UNAUTHORIZED", "Authentication required.");

  const body = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const data: { fullName: string; phone?: string | null } = { fullName: parsed.data.fullName };
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;

  const updated = await db.profile.update({
    where: { id: user.profileId },
    data,
    select: { fullName: true, phone: true },
  });

  return ok({ profile: updated, message: "Profile updated." });
});
