import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Support access (break-glass) for Super Admins.
 *
 * By default the Super Admin sees aggregate metrics only — never a client's
 * individual orders or sales. When there is a legitimate support need, the
 * admin creates a time-boxed SupportGrant for ONE client with a written
 * reason. While the grant is active, grant-scoped detail pages become
 * reachable and every view is written to AuditLog.
 */

export const SUPPORT_GRANT_MAX_HOURS = 24;

export type SupportGrant = {
  id: string;
  clientId: string;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
};

export async function getActiveGrant(
  adminProfileId: string,
  clientId: string
): Promise<SupportGrant | null> {
  const grant = await db.supportGrant.findFirst({
    where: {
      adminProfileId,
      clientId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, clientId: true, reason: true, createdAt: true, expiresAt: true },
  });
  return grant;
}

// Memoized per request — the support gate is checked in generateMetadata AND
// in the page without doubling the DB roundtrip.
export const getActiveGrantCached = cache(getActiveGrant);

export async function createSupportGrant(opts: {
  adminProfileId: string;
  adminEmail: string;
  clientId: string;
  reason: string;
  hours: number;
}): Promise<SupportGrant> {
  const hours = Math.min(Math.max(1, Math.floor(opts.hours)), SUPPORT_GRANT_MAX_HOURS);
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

  // One live grant per admin+client — supersede any previous one.
  await db.supportGrant.updateMany({
    where: {
      adminProfileId: opts.adminProfileId,
      clientId: opts.clientId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { revokedAt: new Date() },
  });

  const grant = await db.supportGrant.create({
    data: {
      adminProfileId: opts.adminProfileId,
      clientId: opts.clientId,
      reason: opts.reason,
      expiresAt,
    },
    select: { id: true, clientId: true, reason: true, createdAt: true, expiresAt: true },
  });

  await logAudit({
    actorProfileId: opts.adminProfileId,
    actorEmail: opts.adminEmail,
    action: "SUPPORT_GRANT_CREATE",
    targetType: "Client",
    targetId: opts.clientId,
    clientId: opts.clientId,
    metadata: { grantId: grant.id, hours, reason: opts.reason, expiresAt: expiresAt.toISOString() },
  });

  return grant;
}

export async function revokeSupportGrant(opts: {
  grantId: string;
  adminProfileId: string;
  adminEmail: string;
}): Promise<boolean> {
  const grant = await db.supportGrant.findUnique({
    where: { id: opts.grantId },
    select: { id: true, clientId: true, adminProfileId: true, revokedAt: true },
  });
  if (!grant) return false;

  if (!grant.revokedAt) {
    await db.supportGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date() },
    });
  }
  await logAudit({
    actorProfileId: opts.adminProfileId,
    actorEmail: opts.adminEmail,
    action: "SUPPORT_GRANT_REVOKE",
    targetType: "Client",
    targetId: grant.clientId,
    clientId: grant.clientId,
    metadata: { grantId: grant.id },
  });
  return true;
}

// ─────────────────────── Audit log ───────────────────────

export async function logAudit(entry: {
  actorProfileId?: string | null;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog
    .create({
      data: {
        actorProfileId: entry.actorProfileId ?? null,
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        clientId: entry.clientId,
        metadata: entry.metadata
          ? JSON.stringify(entry.metadata).slice(0, 2000)
          : undefined,
      },
    })
    .catch((err) => {
      // Never let a broken audit write take down the page — but make it loud.
      console.error("[audit] failed to write audit log:", err);
    });
}

export async function listAuditLogs(opts: {
  page: number;
  pageSize: number;
  action?: string;
  clientId?: string;
}) {
  const where = {
    ...(opts.action ? { action: opts.action } : {}),
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total, page: opts.page, pageSize: opts.pageSize };
}
