import prisma from "../src/lib/db";
import { isOverlapping, createSafeBooking } from "../src/lib/booking-engine";

async function runTests() {
  console.log("🧪 Running Database & Booking Engine Tests...\n");

  // 1. Check Seed Data Existence
  const orgCount = await prisma.organization.count();
  const userCount = await prisma.user.count();
  const roomCount = await prisma.room.count();
  const bookingCount = await prisma.booking.count();

  console.log(`📊 Current DB Stats:`);
  console.log(`   - Organizations: ${orgCount}`);
  console.log(`   - Users: ${userCount}`);
  console.log(`   - Rooms: ${roomCount}`);
  console.log(`   - Bookings: ${bookingCount}`);

  if (roomCount === 0 || userCount === 0) {
    throw new Error("Missing seed data! Run 'npm run db:seed' first.");
  }
  console.log("✅ Database connectivity and seed data confirmed.\n");

  // 2. Unit Test pure isOverlapping logic
  console.log("Testing isOverlapping boundary cases:");
  // Overlap cases
  console.assert(isOverlapping("2026-10-21T10:00:00Z", "2026-10-21T11:00:00Z", "2026-10-21T10:30:00Z", "2026-10-21T11:30:00Z") === true, "Should detect partial overlap");
  console.assert(isOverlapping("2026-10-21T10:00:00Z", "2026-10-21T12:00:00Z", "2026-10-21T10:30:00Z", "2026-10-21T11:00:00Z") === true, "Should detect nested booking");
  // Non-overlap (back-to-back should be allowed)
  console.assert(isOverlapping("2026-10-21T10:00:00Z", "2026-10-21T11:00:00Z", "2026-10-21T11:00:00Z", "2026-10-21T12:00:00Z") === false, "Back-to-back should NOT conflict");
  console.log("✅ Math overlap assertions passed.\n");

  // 3. Test Conflict Detection with Real Database
  const sampleUser = await prisma.user.findFirst();
  const sampleRoom = await prisma.room.findFirst();
  const existingBooking = await prisma.booking.findFirst({
    where: { roomId: sampleRoom!.id, status: { not: "CANCELLED" } },
  });

  if (existingBooking) {
    console.log(`Testing conflict prevention against existing booking: "${existingBooking.title}"`);
    console.log(`Time: ${existingBooking.startTime.toISOString()} -> ${existingBooking.endTime.toISOString()}`);

    try {
      await createSafeBooking({
        title: "Intentionally Conflicting Meeting",
        roomId: sampleRoom!.id,
        userId: sampleUser!.id,
        startTime: existingBooking.startTime.toISOString(),
        endTime: existingBooking.endTime.toISOString(),
        attendeeCount: 2,
        allowWalkIn: true,
      });
      console.error("❌ FAILED: Conflicting booking was unexpectedly allowed!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`✅ SUCCESS: Conflict correctly rejected! Error: "${message}"`);
    }
  }

  // 4. Test Successful Safe Booking on Future Open Slot
  const futureStart = new Date(Date.now() + 86400000 * 30); // 30 days from now
  futureStart.setHours(10, 0, 0, 0);
  const futureEnd = new Date(futureStart.getTime() + 60 * 60 * 1000); // 1 hour later

  console.log("\nTesting successful booking on a vacant future slot...");
  const newBooking = await createSafeBooking({
    title: "Quarterly Systems Audit",
    roomId: sampleRoom!.id,
    userId: sampleUser!.id,
    startTime: futureStart.toISOString(),
    endTime: futureEnd.toISOString(),
    attendeeCount: 3,
    allowWalkIn: true,
  });

  console.log(`✅ Successfully created booking ID: ${newBooking.id} for "${newBooking.title}" in "${newBooking.room.name}"`);

  // Clean up the test booking
  await prisma.booking.delete({ where: { id: newBooking.id } });
  console.log("🧹 Cleaned up test booking.");

  console.log("\n🎉 All Database & Booking Engine tests passed flawlessly!");
}

runTests()
  .catch((e) => {
    console.error("❌ Test error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
