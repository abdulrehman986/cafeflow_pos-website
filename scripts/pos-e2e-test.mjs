/**
 * POS API end-to-end test (local dev server on :3000).
 *
 * Ensures an ACTIVE license exists (seeds a clearly-labeled E2E test client →
 * restaurant → license when none is available), activates a test device,
 * round-trips all five sync streams, re-sends them to prove idempotency, then
 * DELETES everything it created (device, synced records, sync logs, and the
 * seeded chain if it created one). Safe to re-run.
 *
 * Usage: node scripts/pos-e2e-test.mjs [baseUrl]
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = process.argv[2] ?? "http://localhost:3000";
const RUN = `e2e-${Date.now().toString(36)}`;
const DEVICE_ID = `POS-${RUN}`;

let pass = 0;
let failCount = 0;
const ok = (name, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    console.log(`  ✗ ${name} ${detail}`);
  }
};

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}`, "X-Device-Token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const iso = (d) => new Date(d).toISOString();

async function main() {
  console.log(`POS E2E test → ${BASE} (run ${RUN})`);

  // 1. Find an ACTIVE license with a free device slot — seed one if the DB
  // has no usable license at all.
  const licenses = await db.license.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
    include: { restaurant: { select: { id: true, name: true } }, devices: { where: { status: "ACTIVE" } } },
  });
  let license = licenses.find((l) => l.devices.length < l.maxDevices);
  let seededClientId = null;
  let seeded = false;

  if (!license) {
    const licenseKey = `CF-E2E0-${RUN.slice(-8, -4).toUpperCase().padStart(4, "0")}-${RUN.slice(-4).toUpperCase().padStart(4, "0")}`;
    const client = await db.client.create({
      data: { name: `E2E Runner ${RUN}`, email: `${RUN}@e2e.local`, companyName: "E2E Test Co" },
    });
    seededClientId = client.id;
    const restaurant = await db.restaurant.create({
      data: { clientId: client.id, name: `E2E Test Restaurant ${RUN}` },
    });
    license = await db.license.create({
      data: {
        restaurantId: restaurant.id,
        licenseKey,
        status: "ACTIVE",
        maxDevices: 3,
        expiresAt: new Date(Date.now() + 365 * 86400e3),
      },
      include: { restaurant: { select: { id: true, name: true } }, devices: { where: { status: "ACTIVE" } } },
    });
    seeded = true;
    console.log(`Seeded E2E test chain (client/restaurant/license ${licenseKey}) — removed again at the end.`);
  }
  console.log(`Using license of restaurant "${license.restaurant.name}" (slot ${license.devices.length + 1}/${license.maxDevices})`);

  // 2. Activate a test device.
  const act = await api("POST", "/api/pos/license/activate", {
    licenseKey: license.licenseKey,
    deviceIdentifier: DEVICE_ID,
    deviceName: `E2E Test Device ${RUN}`,
    osInfo: "e2e-script",
    appVersion: "test",
  });
  ok("activate → 200 + deviceToken", act.status === 200 && typeof act.json?.data?.deviceToken === "string", JSON.stringify(act.json));
  const token = act.json?.data?.deviceToken;
  if (!token) return;

  // 3. Verify with the token (heartbeat) + status endpoint.
  const ver = await api("POST", "/api/pos/license/verify", {}, token);
  ok("verify(token) → ACTIVE + offlineGrace", ver.status === 200 && ver.json?.data?.status === "ACTIVE" && ver.json?.data?.offlineGrace?.gracePeriodDays > 0, JSON.stringify(ver.json));
  const st = await api("GET", "/api/pos/license/status", undefined, token);
  ok("status → 200", st.status === 200 && st.json?.data?.restaurant?.id === license.restaurant.id, JSON.stringify(st.json));

  // 4. Sync all five streams.
  const sale = { localSaleId: `${RUN}-sale-1`, saleNumber: "E2E-1", saleDate: iso(Date.now()), subtotal: 10, discount: 0, tax: 1, total: 11, paymentMethod: "CASH", status: "COMPLETED" };
  const order = { localOrderId: `${RUN}-ord-1`, orderNumber: "E2E-O1", orderDate: iso(Date.now()), subtotal: 10, tax: 1, total: 11, paymentMethod: "CASH", status: "COMPLETED", items: [{ localItemId: `${RUN}-it-1`, name: "E2E Item", quantity: 1, unitPrice: 10, total: 10, category: "Test" }] };
  const shift = { localShiftId: `${RUN}-shift-1`, shiftNumber: 999, openedAt: iso(Date.now() - 3600e3), closedAt: iso(Date.now()), cashierName: "E2E", openingCash: 100, closingCash: 111, expectedCash: 111, cashDifference: 0, orderCount: 1, grossSales: 11, refundsTotal: 0, expensesTotal: 0, netSales: 11 };
  const refund = { localRefundId: `${RUN}-ref-1`, localOrderId: order.localOrderId, localSaleId: sale.localSaleId, orderNumber: "E2E-O1", amount: 5, reason: "E2E test refund", refundedAt: iso(Date.now()), cashierName: "E2E", supervisorName: "E2E", shiftLocalId: shift.localShiftId };
  const expense = { localExpenseId: `${RUN}-exp-1`, date: iso(Date.now()), category: "Test", description: "E2E test expense", amount: 3, cashierName: "E2E", shiftLocalId: shift.localShiftId };

  const streams = [
    ["/api/pos/sales/sync", { sales: [sale] }],
    ["/api/pos/orders/sync", { orders: [order] }],
    ["/api/pos/shifts/sync", { shifts: [shift] }],
    ["/api/pos/refunds/sync", { refunds: [refund] }],
    ["/api/pos/expenses/sync", { expenses: [expense] }],
  ];

  for (const [path, body] of streams) {
    const r = await api("POST", path, body, token);
    const outcome = r.json?.data?.outcomes?.[0]?.action;
    ok(`${path} → CREATED`, r.status === 200 && outcome === "CREATED", `status ${r.status} ${JSON.stringify(r.json)}`);
  }

  // 5. Re-send everything — must be SKIPPED_DUPLICATE (idempotent).
  for (const [path, body] of streams) {
    const r = await api("POST", path, body, token);
    const outcome = r.json?.data?.outcomes?.[0]?.action;
    ok(`${path} re-send → SKIPPED_DUPLICATE`, r.status === 200 && outcome === "SKIPPED_DUPLICATE", `status ${r.status} ${JSON.stringify(r.json)}`);
  }

  // 6. CORS preflight (what the Tauri webview does first).
  const pre = await fetch(`${BASE}/api/pos/license/verify`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://tauri.localhost",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization,x-device-token",
    },
  });
  ok("CORS preflight → 204 + ACAO", pre.status === 204 && pre.headers.get("access-control-allow-origin") === "http://tauri.localhost", `status ${pre.status}`);

  // 7. Cleanup — remove every record this run created.
  const restaurantId = license.restaurant.id;
  const device = await db.device.findUnique({
    where: { restaurantId_deviceIdentifier: { restaurantId, deviceIdentifier: DEVICE_ID } },
  });
  const sales = await db.sale.findMany({ where: { restaurantId, localSaleId: { startsWith: RUN } } });
  const orders = await db.order.findMany({ where: { restaurantId, localOrderId: { startsWith: RUN } } });
  for (const o of orders) await db.orderItem.deleteMany({ where: { orderId: o.id } });
  const shifts = await db.shift.findMany({ where: { restaurantId, localShiftId: { startsWith: RUN } } });
  const refunds = await db.refund.findMany({ where: { restaurantId, localRefundId: { startsWith: RUN } } });
  const expenses = await db.expense.findMany({ where: { restaurantId, localExpenseId: { startsWith: RUN } } });
  await db.sale.deleteMany({ where: { id: { in: sales.map((s) => s.id) } } });
  await db.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await db.shift.deleteMany({ where: { id: { in: shifts.map((s) => s.id) } } });
  await db.refund.deleteMany({ where: { id: { in: refunds.map((r) => r.id) } } });
  await db.expense.deleteMany({ where: { id: { in: expenses.map((e) => e.id) } } });
  if (device) {
    await db.syncLog.deleteMany({ where: { deviceId: device.id } });
    await db.device.delete({ where: { id: device.id } });
  }
  await db.syncLog.deleteMany({ where: { restaurantId, message: { contains: RUN } } });
  if (seeded && seededClientId) {
    // Cascades: restaurant → license, devices, syncLogs (and the test data).
    await db.client.delete({ where: { id: seededClientId } });
  }
  console.log("  ✓ cleaned up (test device + synced records + seeded chain)");

  console.log(`\nRESULT: ${pass} passed, ${failCount} failed`);
  process.exitCode = failCount > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error("E2E test crashed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
