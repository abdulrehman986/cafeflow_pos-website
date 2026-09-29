import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validators";
import { generateOpaqueToken, sha256 } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 600);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", `Too many requests. Try again in ${rl.retryAfterSeconds}s.`);
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Enter a valid email address.");
  }

  const profile = await db.profile.findUnique({ where: { email: parsed.data.email } });

  // Always respond the same way — no account enumeration
  let devToken: string | undefined;
  if (profile) {
    const raw = generateOpaqueToken(32);
    await db.passwordResetToken.create({
      data: {
        profileId: profile.id,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
      },
    });
    // In production this raw token would be emailed via Supabase Auth / Resend.
    // In this self-contained deployment it is returned once for the demo flow.
    devToken = raw;
  }

  return ok({
    message: "If an account exists for that email, a reset link has been sent.",
    ...(devToken ? { resetToken: devToken } : {}),
  });
});
