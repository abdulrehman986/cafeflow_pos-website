import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ROLES } from "@/lib/constants";

export const POST = handler(async (req: NextRequest) => {
  // Brute-force protection: 10 attempts / 5 min / IP
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 300);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`, {
      retryAfter: rl.retryAfterSeconds,
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { email, password } = parsed.data;

  const profile = await db.profile.findUnique({
    where: { email },
    include: { client: { select: { status: true, name: true } } },
  });

  // Uniform error — never reveal whether the email exists
  if (!profile || !(await verifyPassword(password, profile.passwordHash))) {
    return fail("INVALID_CREDENTIALS", "Invalid email or password.");
  }
  if (!profile.isActive) {
    return fail("FORBIDDEN", "This account has been disabled. Contact support.");
  }
  if (profile.role === ROLES.CLIENT) {
    if (!profile.client) {
      return fail("FORBIDDEN", "Account is not linked to a business. Contact support.");
    }
    if (profile.client.status === "SUSPENDED") {
      return fail("CLIENT_SUSPENDED", "Your business account is suspended. Contact support.");
    }
    if (profile.client.status === "DEACTIVATED") {
      return fail("CLIENT_SUSPENDED", "Your business account is deactivated.");
    }
  }

  await db.profile.update({ where: { id: profile.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    id: profile.id,
    role: profile.role,
    clientId: profile.clientId,
    tokenVersion: profile.tokenVersion,
  });

  return ok({
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      redirectTo: profile.role === ROLES.SUPER_ADMIN ? "/admin" : "/client",
    },
  });
});
