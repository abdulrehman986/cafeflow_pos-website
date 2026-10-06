import { NextRequest } from "next/server";
import { fail, handler, ok } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { adminPasswordResetSchema } from "@/lib/validators";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendPasswordResetEmail } from "@/lib/services/email";
import { generatePassword } from "@/lib/admin-utils";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = adminPasswordResetSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const profile = await db.profile.findFirst({
    where: { clientId: id },
    select: { id: true, email: true, fullName: true },
  });
  if (!profile) return fail("NOT_FOUND", "Client login account not found.");

  if (parsed.data.mode === "LINK") {
    const token = await createPasswordResetToken(profile.id);
    await sendPasswordResetEmail({
      recipient: profile.email,
      recipientName: profile.fullName,
      token,
    });
    return ok({
      message: `A password reset link was sent to ${profile.email}.`,
    });
  }

  const password = parsed.data.password ?? generatePassword();
  await db.$transaction([
    db.profile.update({
      where: { id: profile.id },
      data: {
        passwordHash: await hashPassword(password),
        // Kill any session issued before this reset — same as self-service
        // change and token-based reset.
        tokenVersion: { increment: 1 },
      },
    }),
    db.passwordResetToken.deleteMany({ where: { profileId: profile.id } }),
  ]);

  return ok({
    message: "Temporary password set.",
    account: { email: profile.email, password },
  });
});
