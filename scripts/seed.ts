/**
 * CafeFlow seed - creates only the SUPER_ADMIN account.
 *
 * Run: bunx tsx scripts/seed.ts  (or: bun run scripts/seed.ts)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding CafeFlow with super admin only...");

  // Wipe existing data in FK-safe order so the seed stays repeatable.
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

  await db.profile.create({
    data: {
      email: "cafeflow72@gmail.com",
      fullName: "CafeFlow Admin",
      phone: "+92 309 6345662",
      role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash("Admin@123", 12),
    },
  });

  console.log("Done: 1 super admin (cafeflow72@gmail.com / Admin@123)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
