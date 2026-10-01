import { NextRequest } from "next/server";
import { ok, fail, handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth/guards";
import { createClientSchema, paginationSchema } from "@/lib/validators";
import { listClients } from "@/lib/services/clients";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generatePassword } from "@/lib/admin-utils";
import { CLIENT_STATUSES } from "@/lib/constants";

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? 10,
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid pagination parameters.");

  const result = await listClients({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    search: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  return ok(result);
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const existing = await db.client.findUnique({ where: { email: parsed.data.email } });
  if (existing) return fail("CONFLICT", "A client with this email already exists.");

  // Admin sets the login credentials (email + password). If no password is
  // supplied, a strong one is generated server-side as a fallback.
  const password = parsed.data.password ?? generatePassword();

  // Create client + login account atomically
  const client = await db.client.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      companyName: parsed.data.companyName,
      notes: parsed.data.notes || null,
      status: "ACTIVE",
      profiles: {
        create: {
          email: parsed.data.email,
          fullName: parsed.data.name,
          phone: parsed.data.phone || null,
          role: "CLIENT",
          passwordHash: await hashPassword(password),
        },
      },
    },
    select: { id: true, name: true, companyName: true, email: true, status: true, createdAt: true },
  });

  return ok(
    {
      client,
      // The credentials the user will log in with (stored only as a bcrypt hash;
      // returned once so the admin can hand them over).
      account: { email: parsed.data.email, password },
    },
    { status: 201 }
  );
});
