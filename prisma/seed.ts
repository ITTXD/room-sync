import { PrismaClient } from "@prisma/client";
import { ensureDefaultWorkspace } from "../src/lib/booking-engine";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Resetting database and initializing Meeting Room 1 & Meeting Room 2...");

  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  await ensureDefaultWorkspace();

  const rooms = await prisma.room.findMany({ orderBy: { name: "asc" } });
  console.log(`✅ Created ${rooms.length} Rooms: ${rooms.map((r) => r.name).join(", ")}`);
  console.log("✨ Database ready with 0 bookings.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
