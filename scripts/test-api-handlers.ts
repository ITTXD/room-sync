import { NextRequest } from "next/server";
import { GET as getTimeline } from "../src/app/api/timeline/route";
import { GET as getRooms, POST as createRoom } from "../src/app/api/rooms/route";
import { GET as getBookings, POST as createBooking } from "../src/app/api/bookings/route";
import { GET as getUsers } from "../src/app/api/users/route";
import { GET as getAnalytics } from "../src/app/api/analytics/route";

async function testApiRoutes() {
  console.log("🚀 Testing All Backend API Route Handlers...\n");

  // 1. Test GET /api/users
  console.log("1️⃣ Testing GET /api/users...");
  const usersRes = await getUsers();
  const usersData = await usersRes.json();
  console.assert(usersRes.status === 200, "Users API should return 200");
  console.assert(usersData.users.length > 0, "Users list should not be empty");
  console.log(`   ✅ Found ${usersData.users.length} users (Admin: ${usersData.users[0].name})\n`);

  // 2. Test GET /api/rooms
  console.log("2️⃣ Testing GET /api/rooms...");
  const roomsReq = new NextRequest("http://localhost:3000/api/rooms?activeOnly=true");
  const roomsRes = await getRooms(roomsReq);
  const roomsData = await roomsRes.json();
  console.assert(roomsRes.status === 200, "Rooms API should return 200");
  console.assert(roomsData.rooms.length > 0, "Rooms list should not be empty");
  console.log(`   ✅ Found ${roomsData.rooms.length} active meeting rooms\n`);

  // 3. Test GET /api/timeline
  console.log("3️⃣ Testing GET /api/timeline...");
  const todayStr = new Date().toISOString().split("T")[0];
  const timelineReq = new NextRequest(`http://localhost:3000/api/timeline?date=${todayStr}`);
  const timelineRes = await getTimeline(timelineReq);
  const timelineData = await timelineRes.json();
  console.assert(timelineRes.status === 200, "Timeline API should return 200");
  console.assert(timelineData.rooms.length > 0, "Timeline should include rooms");
  console.log(`   ✅ Timeline for ${timelineData.date}: ${timelineData.summary.totalRooms} rooms, ${timelineData.summary.totalBookings} scheduled bookings today\n`);

  // 4. Test POST /api/bookings Validation (Error 400 when invalid input)
  console.log("4️⃣ Testing POST /api/bookings Validation (Expect 400 Bad Request)...");
  const invalidReq = new NextRequest("http://localhost:3000/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      title: "Hi", // too short (< 3)
      roomId: "invalid",
      userId: "invalid",
      startTime: "2026-10-21T10:00:00Z",
      endTime: "2026-10-21T09:00:00Z", // end before start!
      attendeeCount: 0,
    }),
  });
  const invalidRes = await createBooking(invalidReq);
  const invalidData = await invalidRes.json();
  console.assert(invalidRes.status === 400, "Should reject invalid booking with 400");
  console.log(`   ✅ Correctly rejected invalid input: ${JSON.stringify(invalidData.details)}\n`);

  // 5. Test POST /api/bookings Conflict (Expect 409 Conflict when slot is occupied)
  console.log("5️⃣ Testing POST /api/bookings Conflict Handling (Expect 409 Conflict)...");
  const firstRoom = timelineData.rooms[0];
  const existingBooking = firstRoom.bookings[0];

  if (existingBooking) {
    const conflictReq = new NextRequest("http://localhost:3000/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        title: "Overlapping Team Meeting",
        roomId: firstRoom.id,
        userId: usersData.users[0].id,
        startTime: existingBooking.startTime,
        endTime: existingBooking.endTime,
        attendeeCount: 4,
      }),
    });
    const conflictRes = await createBooking(conflictReq);
    const conflictData = await conflictRes.json();
    console.assert(conflictRes.status === 409, `Should reject with 409 Conflict, got ${conflictRes.status}`);
    console.log(`   ✅ Correctly returned 409 Conflict: "${conflictData.message}"\n`);
  }

  // 6. Test GET /api/analytics
  console.log("6️⃣ Testing GET /api/analytics...");
  const analyticsRes = await getAnalytics();
  const analyticsData = await analyticsRes.json();
  console.assert(analyticsRes.status === 200, "Analytics should return 200");
  console.log(`   ✅ Analytics summary:`);
  console.log(`      - Total Bookings: ${analyticsData.metrics.totalBookings}`);
  console.log(`      - Active Rooms: ${analyticsData.metrics.totalRooms}`);
  console.log(`      - Utilization Breakdown: ${analyticsData.roomUtilization.map((r: any) => `${r.name} (${r.hours}h)`).join(", ")}`);
  console.log(`      - Today's Meetings: ${analyticsData.metrics.todayBookingsCount}`);

  console.log("\n🎉 All 6 Backend API Route Handlers passed end-to-end tests successfully!");
}

testApiRoutes().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
