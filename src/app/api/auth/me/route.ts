import { ok, handler } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";

export const GET = handler(async () => {
  const user = await getSessionUser();
  if (!user) return ok({ user: null });
  return ok({
    user: {
      ...user,
      redirectTo: user.role === "SUPER_ADMIN" ? "/admin" : "/client",
    },
  });
});
