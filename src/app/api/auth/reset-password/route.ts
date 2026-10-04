import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validators";
import { hashPassword, sha256 } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`reset:${clientIp(req)}`, 10, 600);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return fail("UNAUTHORIZED", "This reset link is invalid or has expired.");
  }

  await db.$transaction([
    db.profile.update({
      where: { id: record.profileId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        tokenVersion: { increment: 1 },
      },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return ok({ message: "Password updated. You can now log in." });
});
