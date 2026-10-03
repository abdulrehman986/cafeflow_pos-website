import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentLicense } from "./licenses";
import { sha256 } from "@/lib/auth/password";
import { signDeviceToken } from "@/lib/auth/jwt";
import { LICENSE_GRACE_PERIOD_DAYS } from "@/lib/constants";

/**
 * POS integration service.
 *
 * Security model:
 *  1. Desktop POS activates with its license key + device identifier →
 *     receives a long-lived device token (JWT, bound to device+restaurant+license).
 *  2. The raw device token is NEVER stored server-side — only its SHA-256 hash,
 *     so a database leak cannot be replayed against the API.
 *  3. Every POS request re-validates: device ACTIVE + license ACTIVE + not expired
 *     + restaurant ACTIVE + client ACTIVE.
 *  4. Sync is idempotent via (restaurant_id, local_sale_id) / (restaurant_id, local_order_id)
 *     unique constraints — replays after network failures are safe.
 */

export class PosError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 403) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ─────────────────────── Activation ───────────────────────

export async function activateDevice(input: {
  licenseKey: string;
  deviceIdentifier: string;
  deviceName?: string;
  osInfo?: string;
  appVersion?: string;
}) {
  const license = await db.license.findUnique({
    where: { licenseKey: input.licenseKey.toUpperCase() },
    include: {
      restaurant: {
        select: { id: true, name: true, status: true, client: { select: { id: true, status: true, name: true } } },
      },
    },
  });
  if (!license) throw new PosError("LICENSE_NOT_FOUND", "License key not found.", 404);

  if (license.status === "REVOKED")
    throw new PosError("LICENSE_REVOKED", "This license has been revoked.");
  if (license.status === "SUSPENDED")
    throw new PosError("LICENSE_SUSPENDED", "This license has been suspended.");
  if (license.status === "PENDING")
    throw new PosError("LICENSE_PENDING", "This license has not been activated yet.");
  if (license.status === "EXPIRED" || license.expiresAt < new Date())
    throw new PosError("LICENSE_EXPIRED", "This license has expired.");
  if (license.restaurant.status === "SUSPENDED" || license.restaurant.status === "DEACTIVATED")
    throw new PosError("RESTAURANT_NOT_FOUND", "This restaurant is not active.");
  if (license.restaurant.client.status === "SUSPENDED")
    throw new PosError("CLIENT_SUSPENDED", "The owning client account is suspended.");
  if (license.restaurant.client.status === "DEACTIVATED")
    throw new PosError("CLIENT_SUSPENDED", "The owning client account is deactivated.");

  // Existing device for this restaurant → refresh its token (re-activation path:
  // a Windows reinstall or new install on the same machine identifier just works,
  // and admins can reset/deactivate devices from the dashboard)
  const existing = await db.device.findUnique({
    where: { restaurantId_deviceIdentifier: { restaurantId: license.restaurantId, deviceIdentifier: input.deviceIdentifier } },
  });

  if (existing && existing.status === "BLOCKED") {
    throw new PosError("DEVICE_BLOCKED", "This device has been blocked. Contact support.");
  }
  if (existing && existing.status === "DEACTIVATED") {
    throw new PosError(
      "DEVICE_BLOCKED",
      "This device was deactivated. Ask your administrator to reset it before re-activating."
    );
  }

  if (!existing) {
    const activeCount = await db.device.count({
      where: { restaurantId: license.restaurantId, status: "ACTIVE" },
    });
    if (activeCount >= license.maxDevices) {
      throw new PosError(
        "DEVICE_LIMIT_REACHED",
        `Device limit reached (${license.maxDevices}). Deactivate an existing device or raise the limit.`
      );
    }
  }

  const deviceId = existing?.id ?? crypto.randomUUID();

  // JWT is signed with the real device id, then stored hashed — the raw token
  // only ever exists in the POS application's keyring.
  const jwt = await signDeviceToken(
    {
      deviceId,
      restaurantId: license.restaurantId,
      licenseId: license.id,
      licenseKey: license.licenseKey,
      deviceIdentifier: input.deviceIdentifier,
      scope: "pos",
    },
    process.env.POS_DEVICE_TOKEN_MAX_AGE || "365d"
  );
  const deviceTokenHash = sha256(jwt);

  if (existing) {
    await db.device.update({
      where: { id: existing.id },
      data: {
        licenseId: license.id,
        deviceName: input.deviceName,
        osInfo: input.osInfo,
        appVersion: input.appVersion,
        deviceTokenHash,
        status: "ACTIVE",
        lastSeenAt: new Date(),
        activatedAt: existing.activatedAt ?? new Date(),
      },
    });
  } else {
    await db.device.create({
      data: {
        id: deviceId,
        restaurantId: license.restaurantId,
        licenseId: license.id,
        deviceIdentifier: input.deviceIdentifier,
        deviceName: input.deviceName,
        osInfo: input.osInfo,
        appVersion: input.appVersion,
        deviceTokenHash,
        status: "ACTIVE",
        activatedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  }

  // Ensure license is marked activated + verified now
  await db.license.update({
    where: { id: license.id },
    data: { activatedAt: license.activatedAt ?? new Date(), lastVerifiedAt: new Date() },
  });

  return {
    deviceToken: jwt, // bearer token for POS API calls
    restaurant: { id: license.restaurant.id, name: license.restaurant.name },
    client: { name: license.restaurant.client.name },
    license: {
      key: license.licenseKey,
      status: "ACTIVE",
      expiresAt: license.expiresAt,
      maxDevices: license.maxDevices,
    },
  };
}

// ─────────────────────── Device token authentication ───────────────────────

export interface PosContext {
  device: { id: string; deviceIdentifier: string; deviceName: string | null; status: string };
  license: {
    id: string;
    licenseKey: string;
    status: string;
    expiresAt: Date;
    maxDevices: number;
    lastVerifiedAt: Date | null;
  };
  restaurant: { id: string; name: string; status: string };
  client: { id: string; name: string; status: string };
}

/**
 * Authenticates a POS request from its Bearer device token (JWT).
 * The JWT is verified cryptographically AND cross-checked against the database
 * (token hash match + device/license/restaurant/client still active), so a stolen
 * or revoked token stops working immediately.
 */
export async function authenticatePosDevice(bearerToken: string): Promise<PosContext> {
  const { verifyDeviceToken } = await import("@/lib/auth/jwt");
  const claims = await verifyDeviceToken(bearerToken);
  if (!claims) throw new PosError("DEVICE_NOT_FOUND", "Invalid or expired device token.", 401);

  const device = await db.device.findFirst({
    where: {
      id: claims.deviceId,
      deviceTokenHash: sha256(bearerToken),
    },
    include: {
      restaurant: { select: { id: true, name: true, status: true, client: { select: { id: true, name: true, status: true } } } },
    },
  });
  if (!device)
    throw new PosError("DEVICE_NOT_FOUND", "Device token is no longer valid.", 401);
  if (device.status !== "ACTIVE")
    throw new PosError("DEVICE_BLOCKED", `Device is ${device.status.toLowerCase()}.`, 403);

  const license = await getCurrentLicense(device.restaurantId);
  if (!license || license.id !== device.licenseId)
    throw new PosError("LICENSE_NOT_FOUND", "The license bound to this device no longer applies.", 403);

  if (license.status === "SUSPENDED")
    throw new PosError("LICENSE_SUSPENDED", "License has been suspended.");
  if (license.status === "REVOKED")
    throw new PosError("LICENSE_REVOKED", "License has been revoked.");
  if (license.status === "PENDING")
    throw new PosError("LICENSE_PENDING", "License is not active yet.", 403);
  if (license.status === "EXPIRED" || license.expiresAt < new Date())
    throw new PosError("LICENSE_EXPIRED", "License has expired.", 403);

  if (device.restaurant.status !== "ACTIVE")
    throw new PosError("RESTAURANT_NOT_FOUND", "Restaurant is not active.", 403);
  if (device.restaurant.client.status !== "ACTIVE")
    throw new PosError("CLIENT_SUSPENDED", "Owning client account is not active.", 403);

  // Touch last-seen (fire & forget, no await to keep sync fast)
  void db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});

  return {
    device: { id: device.id, deviceIdentifier: device.deviceIdentifier, deviceName: device.deviceName, status: device.status },
    license: {
      id: license.id,
      licenseKey: license.licenseKey,
      status: license.status,
      expiresAt: license.expiresAt,
      maxDevices: license.maxDevices,
      lastVerifiedAt: license.lastVerifiedAt,
    },
    restaurant: { id: device.restaurant.id, name: device.restaurant.name, status: device.restaurant.status },
    client: { id: device.restaurant.client.id, name: device.restaurant.client.name, status: device.restaurant.client.status },
  };
}

// ─────────────────────── Idempotent sync ───────────────────────

export interface SyncOutcome {
  localId: string;
  /** FAILED = not stored — the POS keeps the record queued and retries.
   * Only CREATED / SKIPPED_DUPLICATE mean "safely stored". */
  action: "CREATED" | "SKIPPED_DUPLICATE" | "FAILED";
}

/** True when a create failed only because the record already exists
 * (idempotency race) — safe to report as a duplicate. */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function syncSales(
  ctx: PosContext,
  sales: Array<{
    localSaleId: string;
    saleNumber?: string;
    saleDate: string;
    subtotal?: number;
    discount?: number;
    tax?: number;
    total: number;
    paymentMethod?: string;
    status?: string;
    customerCount?: number;
  }>
) {
  const outcomes: SyncOutcome[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const sale of sales) {
    try {
      const existing = await db.sale.findUnique({
        where: { restaurantId_localSaleId: { restaurantId: ctx.restaurant.id, localSaleId: sale.localSaleId } },
        select: { id: true },
      });
      if (existing) {
        outcomes.push({ localId: sale.localSaleId, action: "SKIPPED_DUPLICATE" });
        skipped++;
        continue;
      }
      await db.sale.create({
        data: {
          restaurantId: ctx.restaurant.id,
          localSaleId: sale.localSaleId,
          saleNumber: sale.saleNumber,
          saleDate: new Date(sale.saleDate),
          subtotal: sale.subtotal ?? 0,
          discount: sale.discount ?? 0,
          tax: sale.tax ?? 0,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          status: sale.status ?? "COMPLETED",
          customerCount: sale.customerCount,
          syncedAt: new Date(),
        },
      });
      outcomes.push({ localId: sale.localSaleId, action: "CREATED" });
      created++;
    } catch (error) {
      if (isUniqueViolation(error)) {
        outcomes.push({ localId: sale.localSaleId, action: "SKIPPED_DUPLICATE" });
        skipped++;
      } else {
        // Transient/unknown DB failure — the POS must keep this record.
        outcomes.push({ localId: sale.localSaleId, action: "FAILED" });
        failed++;
      }
    }
  }

  const status = failed > 0 ? "PARTIAL" : "SUCCESS";
  await db.syncLog.create({
    data: {
      restaurantId: ctx.restaurant.id,
      deviceId: ctx.device.id,
      recordType: "SALES",
      recordsReceived: sales.length,
      recordsCreated: created,
      recordsSkipped: skipped,
      recordsFailed: failed,
      status,
      message: `Synced ${created} new / ${skipped} duplicate sales for ${ctx.restaurant.name}`,
    },
  });

  return { outcomes, created, skipped, failed, status };
}

export async function syncOrders(
  ctx: PosContext,
  orders: Array<{
    localOrderId: string;
    orderNumber: string;
    orderDate: string;
    subtotal?: number;
    discount?: number;
    tax?: number;
    total: number;
    paymentMethod?: string;
    status?: string;
    customerCount?: number;
    items?: Array<{
      localItemId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      total?: number;
      category?: string;
    }>;
  }>
) {
  const outcomes: SyncOutcome[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const existing = await db.order.findUnique({
        where: { restaurantId_localOrderId: { restaurantId: ctx.restaurant.id, localOrderId: order.localOrderId } },
        select: { id: true },
      });
      if (existing) {
        outcomes.push({ localId: order.localOrderId, action: "SKIPPED_DUPLICATE" });
        skipped++;
        continue;
      }
      await db.order.create({
        data: {
          restaurantId: ctx.restaurant.id,
          localOrderId: order.localOrderId,
          orderNumber: order.orderNumber,
          orderDate: new Date(order.orderDate),
          subtotal: order.subtotal ?? 0,
          discount: order.discount ?? 0,
          tax: order.tax ?? 0,
          total: order.total,
          paymentMethod: order.paymentMethod,
          status: order.status ?? "COMPLETED",
          customerCount: order.customerCount,
          syncedAt: new Date(),
          items: {
            create: (order.items ?? []).map((item) => ({
              localItemId: item.localItemId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total ?? item.quantity * item.unitPrice,
              category: item.category,
            })),
          },
        },
      });
      outcomes.push({ localId: order.localOrderId, action: "CREATED" });
      created++;
    } catch (error) {
      if (isUniqueViolation(error)) {
        outcomes.push({ localId: order.localOrderId, action: "SKIPPED_DUPLICATE" });
        skipped++;
      } else {
        // Transient/unknown DB failure — the POS must keep this record.
        outcomes.push({ localId: order.localOrderId, action: "FAILED" });
        failed++;
      }
    }
  }

  const status = failed > 0 ? "PARTIAL" : "SUCCESS";
  await db.syncLog.create({
    data: {
      restaurantId: ctx.restaurant.id,
      deviceId: ctx.device.id,
      recordType: "ORDERS",
      recordsReceived: orders.length,
      recordsCreated: created,
      recordsSkipped: skipped,
      recordsFailed: failed,
      status,
      message: `Synced ${created} new / ${skipped} duplicate orders for ${ctx.restaurant.name}`,
    },
  });

  return { outcomes, created, skipped, failed, status };
}

// ─────────────────────── Shift / Refund / Expense sync ───────────────────────

export async function syncShifts(
  ctx: PosContext,
  shifts: Array<{
    localShiftId: string;
    shiftNumber?: number;
    openedAt: string;
    closedAt: string;
    cashierName?: string;
    openingCash?: number;
    closingCash?: number;
    expectedCash?: number;
    cashDifference?: number;
    orderCount?: number;
    grossSales?: number;
    refundsTotal?: number;
    expensesTotal?: number;
    netSales?: number;
  }>
) {
  const outcomes: SyncOutcome[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const shift of shifts) {
    try {
      const existing = await db.shift.findUnique({
        where: { restaurantId_localShiftId: { restaurantId: ctx.restaurant.id, localShiftId: shift.localShiftId } },
        select: { id: true },
      });
      if (existing) {
        outcomes.push({ localId: shift.localShiftId, action: "SKIPPED_DUPLICATE" });
        skipped++;
        continue;
      }
      await db.shift.create({
        data: {
          restaurantId: ctx.restaurant.id,
          localShiftId: shift.localShiftId,
          shiftNumber: shift.shiftNumber,
          openedAt: new Date(shift.openedAt),
          closedAt: new Date(shift.closedAt),
          cashierName: shift.cashierName,
          openingCash: shift.openingCash,
          closingCash: shift.closingCash,
          expectedCash: shift.expectedCash,
          cashDifference: shift.cashDifference,
          orderCount: shift.orderCount,
          grossSales: shift.grossSales,
          refundsTotal: shift.refundsTotal,
          expensesTotal: shift.expensesTotal,
          netSales: shift.netSales,
          syncedAt: new Date(),
        },
      });
      outcomes.push({ localId: shift.localShiftId, action: "CREATED" });
      created++;
    } catch (error) {
      if (isUniqueViolation(error)) {
        outcomes.push({ localId: shift.localShiftId, action: "SKIPPED_DUPLICATE" });
        skipped++;
      } else {
        outcomes.push({ localId: shift.localShiftId, action: "FAILED" });
        failed++;
      }
    }
  }

  const status = failed > 0 ? "PARTIAL" : "SUCCESS";
  await db.syncLog.create({
    data: {
      restaurantId: ctx.restaurant.id,
      deviceId: ctx.device.id,
      recordType: "SHIFTS",
      recordsReceived: shifts.length,
      recordsCreated: created,
      recordsSkipped: skipped,
      recordsFailed: failed,
      status,
      message: `Synced ${created} new / ${skipped} duplicate shifts for ${ctx.restaurant.name}`,
    },
  });

  return { outcomes, created, skipped, failed, status };
}

export async function syncRefunds(
  ctx: PosContext,
  refunds: Array<{
    localRefundId: string;
    localOrderId?: string;
    localSaleId?: string;
    orderNumber?: string;
    amount: number;
    reason?: string;
    refundedAt: string;
    cashierName?: string;
    supervisorName?: string;
    shiftLocalId?: string;
  }>
) {
  const outcomes: SyncOutcome[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const refund of refunds) {
    try {
      const existing = await db.refund.findUnique({
        where: { restaurantId_localRefundId: { restaurantId: ctx.restaurant.id, localRefundId: refund.localRefundId } },
        select: { id: true },
      });
      if (existing) {
        outcomes.push({ localId: refund.localRefundId, action: "SKIPPED_DUPLICATE" });
        skipped++;
        continue;
      }
      await db.refund.create({
        data: {
          restaurantId: ctx.restaurant.id,
          localRefundId: refund.localRefundId,
          localOrderId: refund.localOrderId,
          localSaleId: refund.localSaleId,
          orderNumber: refund.orderNumber,
          amount: refund.amount,
          reason: refund.reason,
          refundedAt: new Date(refund.refundedAt),
          cashierName: refund.cashierName,
          supervisorName: refund.supervisorName,
          shiftLocalId: refund.shiftLocalId,
          syncedAt: new Date(),
        },
      });
      outcomes.push({ localId: refund.localRefundId, action: "CREATED" });
      created++;
    } catch (error) {
      if (isUniqueViolation(error)) {
        outcomes.push({ localId: refund.localRefundId, action: "SKIPPED_DUPLICATE" });
        skipped++;
      } else {
        outcomes.push({ localId: refund.localRefundId, action: "FAILED" });
        failed++;
      }
    }
  }

  const status = failed > 0 ? "PARTIAL" : "SUCCESS";
  await db.syncLog.create({
    data: {
      restaurantId: ctx.restaurant.id,
      deviceId: ctx.device.id,
      recordType: "REFUNDS",
      recordsReceived: refunds.length,
      recordsCreated: created,
      recordsSkipped: skipped,
      recordsFailed: failed,
      status,
      message: `Synced ${created} new / ${skipped} duplicate refunds for ${ctx.restaurant.name}`,
    },
  });

  return { outcomes, created, skipped, failed, status };
}

export async function syncExpenses(
  ctx: PosContext,
  expenses: Array<{
    localExpenseId: string;
    date: string;
    category?: string;
    description?: string;
    amount: number;
    cashierName?: string;
    shiftLocalId?: string;
  }>
) {
  const outcomes: SyncOutcome[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const expense of expenses) {
    try {
      const existing = await db.expense.findUnique({
        where: { restaurantId_localExpenseId: { restaurantId: ctx.restaurant.id, localExpenseId: expense.localExpenseId } },
        select: { id: true },
      });
      if (existing) {
        outcomes.push({ localId: expense.localExpenseId, action: "SKIPPED_DUPLICATE" });
        skipped++;
        continue;
      }
      await db.expense.create({
        data: {
          restaurantId: ctx.restaurant.id,
          localExpenseId: expense.localExpenseId,
          date: new Date(expense.date),
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          cashierName: expense.cashierName,
          shiftLocalId: expense.shiftLocalId,
          syncedAt: new Date(),
        },
      });
      outcomes.push({ localId: expense.localExpenseId, action: "CREATED" });
      created++;
    } catch (error) {
      if (isUniqueViolation(error)) {
        outcomes.push({ localId: expense.localExpenseId, action: "SKIPPED_DUPLICATE" });
        skipped++;
      } else {
        outcomes.push({ localId: expense.localExpenseId, action: "FAILED" });
        failed++;
      }
    }
  }

  const status = failed > 0 ? "PARTIAL" : "SUCCESS";
  await db.syncLog.create({
    data: {
      restaurantId: ctx.restaurant.id,
      deviceId: ctx.device.id,
      recordType: "EXPENSES",
      recordsReceived: expenses.length,
      recordsCreated: created,
      recordsSkipped: skipped,
      recordsFailed: failed,
      status,
      message: `Synced ${created} new / ${skipped} duplicate expenses for ${ctx.restaurant.name}`,
    },
  });

  return { outcomes, created, skipped, failed, status };
}

/** License status + offline grace info for periodic POS verification. */
export function licenseVerificationPayload(ctx: PosContext) {
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((ctx.license.expiresAt.getTime() - now.getTime()) / 86400000));
  const lastVerified = ctx.license.lastVerifiedAt ?? now;
  const daysSinceVerification = Math.floor((now.getTime() - lastVerified.getTime()) / 86400000);
  return {
    licenseKey: ctx.license.licenseKey,
    status: ctx.license.status,
    expiresAt: ctx.license.expiresAt,
    daysRemaining,
    maxDevices: ctx.license.maxDevices,
    restaurant: { id: ctx.restaurant.id, name: ctx.restaurant.name },
    offlineGrace: {
      // POS may keep operating within this window without connectivity
      gracePeriodDays: LICENSE_GRACE_PERIOD_DAYS,
      daysSinceLastVerification: daysSinceVerification,
      withinGracePeriod: daysSinceVerification <= LICENSE_GRACE_PERIOD_DAYS,
    },
    serverTime: now.toISOString(),
  };
}
