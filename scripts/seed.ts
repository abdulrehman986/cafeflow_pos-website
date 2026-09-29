/**
 * CafeFlow seed — realistic demo data in the REAL database (no frontend mocks).
 *
 * Creates:
 *   1 SUPER_ADMIN login
 *   9 clients (1 suspended) → 17 restaurants → licenses (mixed statuses incl.
 *   expiring-soon / expired / suspended) → devices → 30 days of sales + orders
 *   with line items → sync logs.
 *
 * Run: bunx tsx scripts/seed.ts  (or: bun run scripts/seed.ts)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes, createHash } from "crypto";

const db = new PrismaClient();

// ── deterministic RNG so re-seeding produces comparable data ──
let seed = 42;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function rint(min: number, max: number) {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

const MENUS: Record<string, Array<[string, number, string]>> = {
  default: [
    ["Chicken Karahi (Half)", 1450, "Main"],
    ["Chicken Karahi (Full)", 2750, "Main"],
    ["Beef Biryani", 550, "Rice"],
    ["Chicken Biryani", 480, "Rice"],
    ["Mutton Palao", 680, "Rice"],
    ["Chicken Tikka (4pc)", 780, "BBQ"],
    ["Seekh Kabab (4pc)", 850, "BBQ"],
    ["Malai Boti (8pc)", 1150, "BBQ"],
    ["Paratha", 90, "Bread"],
    ["Naan", 60, "Bread"],
    ["Roghnai Naan", 90, "Bread"],
    ["Chai (Kadak)", 150, "Drinks"],
    ["Doodh Patti", 180, "Drinks"],
    ["Cold Coffee", 420, "Drinks"],
    ["Fresh Lime Soda", 250, "Drinks"],
    ["Gulab Jamun (2pc)", 220, "Dessert"],
    ["Falooda", 380, "Dessert"],
    ["Kheer", 260, "Dessert"],
    ["Zinger Burger", 690, "Fast food"],
    ["Loaded Fries", 420, "Fast food"],
  ],
};

function licenseKey(): string {
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ2346789";
  const part = () =>
    Array.from(randomBytes(4)).map((b) => ALPHA[b % ALPHA.length]).join("");
  return `CF-${part()}-${part()}-${part()}`;
}

interface RestaurantSpec {
  name: string;
  city: string;
  license: { months: number; fromNow?: boolean; status?: string; maxDevices: number };
  hasDevice: boolean;
  scale: number; // daily order multiplier
  menu?: string;
}

interface ClientSpec {
  contact: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  notes?: string;
  restaurants: RestaurantSpec[];
}

const CLIENTS: ClientSpec[] = [
  {
    contact: "Ahmed Raza",
    company: "Ahmed Restaurants",
    email: "ahmed@cafeflow.app",
    phone: "+92 300 1112233",
    status: "ACTIVE",
    notes: "Flagship client — 3 cities, evaluating a 4th branch in Rawalpindi.",
    restaurants: [
      { name: "Lahore Restaurant", city: "Lahore", license: { months: 18, maxDevices: 2 }, hasDevice: true, scale: 1.0 },
      { name: "Islamabad Restaurant", city: "Islamabad", license: { months: 24, maxDevices: 1 }, hasDevice: true, scale: 0.8 },
      { name: "Karachi Restaurant", city: "Karachi", license: { months: 1, maxDevices: 2 }, hasDevice: true, scale: 1.15 }, // expiring soon
    ],
  },
  {
    contact: "Fatima Sheikh",
    company: "Spice Bazaar",
    email: "fatima@cafeflow.app",
    phone: "+92 301 2223344",
    status: "ACTIVE",
    restaurants: [
      { name: "Spice Bazaar DHA", city: "Lahore", license: { months: 2, maxDevices: 1 }, hasDevice: true, scale: 0.7 }, // expiring soon
      { name: "Spice Bazaar Gulberg", city: "Lahore", license: { months: 14, maxDevices: 1 }, hasDevice: true, scale: 0.65 },
    ],
  },
  {
    contact: "Hassan Mirza",
    company: "Brew & Bite",
    email: "hassan@cafeflow.app",
    phone: "+92 302 3334455",
    status: "ACTIVE",
    restaurants: [
      { name: "Brew & Bite Clifton", city: "Karachi", license: { months: 20, maxDevices: 3 }, hasDevice: true, scale: 0.9 },
      { name: "Brew & Bite Bahria", city: "Karachi", license: { months: 11, maxDevices: 1 }, hasDevice: true, scale: 0.75 },
    ],
  },
  {
    contact: "Zain Ul Abideen",
    company: "Karachi Kitchen Co",
    email: "zain@cafeflow.app",
    phone: "+92 303 4445566",
    status: "ACTIVE",
    restaurants: [
      { name: "KKC Burns Road", city: "Karachi", license: { months: -1, maxDevices: 1 }, hasDevice: true, scale: 0.5 }, // EXPIRED
    ],
  },
  {
    contact: "Maryam Nawaz",
    company: "Desert Rose Cafés",
    email: "maryam@cafeflow.app",
    phone: "+92 304 5556677",
    status: "ACTIVE",
    restaurants: [
      { name: "Desert Rose Bahawalpur", city: "Bahawalpur", license: { months: 9, maxDevices: 1 }, hasDevice: true, scale: 0.55 },
      { name: "Desert Rose Multan Cantt", city: "Multan", license: { months: 16, maxDevices: 1 }, hasDevice: false, scale: 0.5 },
    ],
  },
  {
    contact: "Imran Khan Khattak",
    company: "Peshawar Chapli House",
    email: "imran@cafeflow.app",
    phone: "+92 305 6667788",
    status: "ACTIVE",
    restaurants: [
      { name: "Chapli House University Rd", city: "Peshawar", license: { months: 13, maxDevices: 2 }, hasDevice: true, scale: 0.85 },
    ],
  },
  {
    contact: "Ali Raza",
    company: "Faisalabad Food Court",
    email: "ali@cafeflow.app",
    phone: "+92 306 7778899",
    status: "ACTIVE",
    restaurants: [
      { name: "FFC Satyana Road", city: "Faisalabad", license: { months: 10, maxDevices: 2 }, hasDevice: true, scale: 0.9 },
      { name: "FFC Peoples Colony", city: "Faisalabad", license: { months: 22, maxDevices: 1 }, hasDevice: true, scale: 0.7 },
      { name: "FFC Jinnah Colony", city: "Faisalabad", license: { months: 15, maxDevices: 1 }, hasDevice: false, scale: 0.6 },
    ],
  },
  {
    contact: "Sana Javed",
    company: "Multan Sweets & Bakes",
    email: "sana@cafeflow.app",
    phone: "+92 307 8889900",
    status: "ACTIVE",
    restaurants: [
      { name: "Multan Sweets Hussain Agahi", city: "Multan", license: { months: 8, maxDevices: 1 }, hasDevice: true, scale: 0.6 },
      { name: "Bakes N Chowk Bazaar", city: "Multan", license: { months: 6, maxDevices: 1, status: "SUSPENDED" }, hasDevice: true, scale: 0.45 },
    ],
  },
  {
    contact: "Bilal Ahmed",
    company: "Quetta Café Point",
    email: "bilal@cafeflow.app",
    phone: "+92 308 9990011",
    status: "SUSPENDED",
    notes: "Payment dispute since August — suspended pending resolution.",
    restaurants: [
      { name: "Café Point Jinnah Road", city: "Quetta", license: { months: 4, maxDevices: 1, status: "SUSPENDED" }, hasDevice: true, scale: 0.4 },
    ],
  },
];

async function main() {
  console.log("Seeding CafeFlow…");

  // Wipe in FK-safe order
  await db.syncLog.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.sale.deleteMany();
  await db.device.deleteMany();
  await db.license.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.profile.deleteMany();
  await db.restaurant.deleteMany();
  await db.client.deleteMany();

  // ── SUPER_ADMIN ──
  await db.profile.create({
    data: {
      email: "admin@cafeflow.app",
      fullName: "CafeFlow Admin",
      phone: "+92 321 0000000",
      role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash("Admin@123", 12),
    },
  });
  console.log("✓ super admin (admin@cafeflow.app / Admin@123)");

  const menu = MENUS.default;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const DAYS = 30;
  let orderCount = 0;
  let saleCount = 0;

  for (const spec of CLIENTS) {
    const client = await db.client.create({
      data: {
        name: spec.contact,
        email: spec.email,
        phone: spec.phone,
        companyName: spec.company,
        status: spec.status,
        notes: spec.notes ?? null,
      },
    });

    await db.profile.create({
      data: {
        email: spec.email,
        fullName: spec.contact,
        phone: spec.phone,
        role: "CLIENT",
        clientId: client.id,
        passwordHash: await bcrypt.hash("Client@123", 12),
        lastLoginAt: new Date(now.getTime() - rint(1, 96) * 3600000),
      },
    });

    for (const r of spec.restaurants) {
      const restaurant = await db.restaurant.create({
        data: {
          clientId: client.id,
          name: r.name,
          city: r.city,
          phone: spec.phone,
          status: "ACTIVE",
          createdAt: new Date(now.getTime() - rint(90, 700) * 86400000),
        },
      });

      // License — months can be negative (already expired)
      const expires = new Date(now.getTime() + r.license.months * 30 * 86400000);
      const license = await db.license.create({
        data: {
          restaurantId: restaurant.id,
          licenseKey: licenseKey(),
          status: r.license.status ?? (r.license.months <= 0 ? "EXPIRED" : "ACTIVE"),
          maxDevices: r.license.maxDevices,
          activatedAt: new Date(now.getTime() - rint(60, 400) * 86400000),
          expiresAt: expires,
          lastVerifiedAt: new Date(now.getTime() - rint(1, 70) * 3600000),
          createdAt: new Date(now.getTime() - rint(90, 400) * 86400000),
        },
      });

      // Device (historical activation; token hash is inert demo material)
      if (r.hasDevice) {
        const deviceCount = Math.min(r.license.maxDevices, rint(1, 2));
        for (let i = 0; i < deviceCount; i++) {
          await db.device.create({
            data: {
              restaurantId: restaurant.id,
              licenseId: license.id,
              deviceIdentifier: `DESKTOP-${createHash("sha1").update(restaurant.id + i).digest("hex").slice(0, 6).toUpperCase()}`,
              deviceName: i === 0 ? `POS Terminal ${i + 1} — ${r.city}` : `Counter ${i + 1} — ${r.name}`,
              osInfo: "Windows 11 Pro 22631.4317",
              appVersion: "1.4.2",
              deviceTokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
              status: license.status === "ACTIVE" ? "ACTIVE" : "ACTIVE",
              activatedAt: new Date(now.getTime() - rint(30, 350) * 86400000),
              lastSeenAt: new Date(now.getTime() - rint(0, 50) * 3600000),
            },
          });
        }
      }

      // ── 30 days of sales + orders ──
      for (let d = DAYS - 1; d >= 0; d--) {
        const day = new Date(today.getTime() - d * 86400000);
        const dow = day.getUTCDay();
        const weekendBoost = dow === 0 || dow === 6 ? 1.3 : 1;
        const isToday = d === 0;
        // Today: only up to the current hour (partial day, feels "live")
        const maxHour = isToday ? Math.max(9, now.getUTCHours()) : 23;

        const base = Math.round(rint(9, 17) * r.scale * weekendBoost * (isToday ? 0.6 : 1));
        for (let n = 0; n < base; n++) {
          const localId = randomUUID();
          const orderNumber = `${String(rint(1, 999)).padStart(4, "0")}-${day.toISOString().slice(2, 4)}${day.getUTCMonth() + 1}${day.getUTCDate()}`;
          const hour = rint(8, maxHour);
          const orderDate = new Date(day.getTime() + hour * 3600000 + rint(0, 59) * 60000);

          const itemCount = rint(1, 6);
          const chosen: Array<{ name: string; qty: number; unit: number; cat: string; total: number }> = [];
          for (let it = 0; it < itemCount; it++) {
            const [name, unit, cat] = pick(menu);
            if (chosen.some((c) => c.name === name)) continue;
            const qty = rint(1, 3);
            chosen.push({ name, qty, unit, cat, total: qty * unit });
          }
          const subtotal = chosen.reduce((a, c) => a + c.total, 0);
          const discount = rnd() < 0.18 ? Math.round(subtotal * pick([0.05, 0.1, 0.15])) : 0;
          const tax = Math.round((subtotal - discount) * 0.05);
          const total = subtotal - discount + tax;
          const payment = pick(["CASH", "CASH", "CASH", "CARD", "CARD", "MOBILE", "MOBILE", "OTHER"]);

          const orderId = randomUUID();
          await db.order.create({
            data: {
              id: orderId,
              restaurantId: restaurant.id,
              localOrderId: localId,
              orderNumber,
              orderDate,
              subtotal,
              discount,
              tax,
              total,
              paymentMethod: payment,
              status: rnd() < 0.985 ? "COMPLETED" : "CANCELLED",
              customerCount: rint(1, 6),
              syncedAt: new Date(Math.min(orderDate.getTime() + rint(2, 300) * 60000, now.getTime())),
              items: {
                create: chosen.map((c) => ({
                  localItemId: randomUUID(),
                  name: c.name,
                  quantity: c.qty,
                  unitPrice: c.unit,
                  total: c.total,
                  category: c.cat,
                })),
              },
            },
          });
          orderCount++;

          // Matching financial sale record (same local UUID → coherent numbers)
          await db.sale.create({
            data: {
              restaurantId: restaurant.id,
              localSaleId: localId,
              saleNumber: orderNumber,
              saleDate: orderDate,
              subtotal,
              discount,
              tax,
              total,
              paymentMethod: payment,
              status: "COMPLETED",
              customerCount: rint(1, 6),
              syncedAt: new Date(Math.min(orderDate.getTime() + rint(2, 300) * 60000, now.getTime())),
            },
          });
          saleCount++;
        }
      }

      // Sync logs — recent activity per restaurant
      const logDays = rint(2, 5);
      for (let l = 0; l < logDays; l++) {
        const createdAt = new Date(now.getTime() - rint(0, 20) * 3600000);
        await db.syncLog.create({
          data: {
            restaurantId: restaurant.id,
            recordType: l % 2 === 0 ? "SALES" : "ORDERS",
            recordsReceived: rint(4, 40),
            recordsCreated: rint(3, 30),
            recordsSkipped: rint(0, 8),
            recordsFailed: 0,
            status: "SUCCESS",
            message: `Synced ${rint(3, 30)} records for ${r.name}`,
            createdAt,
          },
        });
      }
    }
    console.log(`✓ ${spec.company} (${spec.restaurants.length} restaurants)`);
  }

  console.log(`Done: ${CLIENTS.length} clients, ${CLIENTS.reduce((a, c) => a + c.restaurants.length, 0)} restaurants, ${orderCount} orders, ${saleCount} sales.`);
  console.log("Logins — admin@cafeflow.app/Admin@123 · ahmed@cafeflow.app/Client@123 (all clients use Client@123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
