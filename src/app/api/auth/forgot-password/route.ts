import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validators";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendPasswordResetEmail } from "@/lib/services/email";

export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 600);
  if (!rl.allowed) {
    return fail(
      "RATE_LIMITED",
      `Too many requests. Try again in ${rl.retryAfterSeconds}s.`,
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Enter a valid email address.");
  }

  const profile = await db.profile.findUnique({
    where: { email: parsed.data.email },
  });

  // Uniform response — returning "account not found" would let anyone
  // enumerate registered (admin!) emails.
  if (profile) {
    const token = await createPasswordResetToken(profile.id);
    await sendPasswordResetEmail({
      recipient: profile.email,
      recipientName: profile.fullName,
      token,
    });
  }

  return ok({
    message:
      "If an account exists for this address, a password reset link has been sent.",
  });
});
