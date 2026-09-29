import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fail } from "@/lib/api";
import { getSessionUser, type SessionUser } from "./session";
import { ROLES } from "@/lib/constants";

// ─────────────────── Page guards (server components / layouts) ───────────────────

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== ROLES.SUPER_ADMIN) redirect("/client");
  return user;
}

export async function requireClientPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === ROLES.SUPER_ADMIN) redirect("/admin");
  if (!user.clientId) redirect("/login");
  return user;
}

// ─────────────────── API guards (route handlers) ───────────────────

export async function requireAdminApi(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: fail("UNAUTHORIZED", "Authentication required.") };
  if (user.role !== ROLES.SUPER_ADMIN)
    return { ok: false, response: fail("FORBIDDEN", "Super admin access required.") };
  return { ok: true, user };
}

export async function requireClientApi(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: fail("UNAUTHORIZED", "Authentication required.") };
  if (user.role !== ROLES.CLIENT)
    return { ok: false, response: fail("FORBIDDEN", "Client access required.") };
  if (!user.clientId)
    return { ok: false, response: fail("FORBIDDEN", "Account is not linked to a client business.") };
  return { ok: true, user };
}

// ─────────────────── Row-level scoping (the app-level "RLS") ───────────────────
// NEVER trust restaurant/client ids coming from request params — always
// re-verify ownership against the session's clientId before reading/writing.

export async function assertRestaurantAccess(
  user: SessionUser,
  restaurantId: string
): Promise<
  { ok: true; restaurant: { id: string; clientId: string; name: string; status: string } } | { ok: false; response: Response }
> {
  if (user.role !== ROLES.CLIENT) {
    return { ok: false, response: fail("FORBIDDEN", "Client access required.") };
  }
  if (!user.clientId) {
    return { ok: false, response: fail("FORBIDDEN", "No client linked to this account.") };
  }
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, clientId: true, name: true, status: true },
  });
  if (!restaurant || restaurant.clientId !== user.clientId) {
    // Same response for "does not exist" and "belongs to someone else" — no data leak
    return { ok: false, response: fail("RESTAURANT_NOT_FOUND", "Restaurant not found.") };
  }
  return { ok: true, restaurant };
}
