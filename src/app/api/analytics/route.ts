import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const [rooms, allBookings, todayBookings, usersCount] = await Promise.all([
      prisma.room.findMany({
        where: { isActive: true },
        select: { id: true, name: true, capacity: true, colorCode: true, amenitiesJson: true },
      }),
      prisma.booking.findMany({
        include: {
          room: { select: { id: true, name: true } },
          user: { select: { department: true } },
        },
      }),
      prisma.booking.findMany({
        where: {
          startTime: { lte: endOfToday },
          endTime: { gte: startOfToday },
          status: { not: "CANCELLED" },
        },
        include: {
          room: { select: { name: true, colorCode: true } },
          user: { select: { name: true, department: true, avatarUrl: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.user.count(),
    ]);

    // Calculate booking stats
    const totalBookings = allBookings.length;
    const confirmedCount = allBookings.filter((b) => b.status === "CONFIRMED").length;
    const checkedInCount = allBookings.filter((b) => b.status === "CHECKED_IN").length;
    const cancelledCount = allBookings.filter((b) => b.status === "CANCELLED").length;

    // Room Utilization Calculation (Based on active bookings)
    const activeBookings = allBookings.filter((b) => b.status !== "CANCELLED");
    const roomUtilizationMap: Record<string, { name: string; hours: number; color: string; bookingCount: number }> = {};

    rooms.forEach((r) => {
      roomUtilizationMap[r.id] = {
        name: r.name,
        hours: 0,
        color: r.colorCode,
        bookingCount: 0,
      };
    });

    activeBookings.forEach((b) => {
      if (roomUtilizationMap[b.roomId]) {
        const durationHours =
          (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
        roomUtilizationMap[b.roomId].hours += Math.round(durationHours * 10) / 10;
        roomUtilizationMap[b.roomId].bookingCount += 1;
      }
    });

    // Peak Hours Breakdown (8:00 - 20:00)
    const hourlyDistribution: Record<number, number> = {};
    for (let h = 8; h <= 19; h++) {
      hourlyDistribution[h] = 0;
    }

    activeBookings.forEach((b) => {
      const startH = new Date(b.startTime).getHours();
      const endH = new Date(b.endTime).getHours();
      for (let h = Math.max(8, startH); h <= Math.min(19, endH); h++) {
        hourlyDistribution[h] = (hourlyDistribution[h] || 0) + 1;
      }
    });

    // Department breakdown
    const departmentUsage: Record<string, number> = {};
    activeBookings.forEach((b) => {
      const dept = b.user.department || "General";
      departmentUsage[dept] = (departmentUsage[dept] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      metrics: {
        totalRooms: rooms.length,
        totalUsers: usersCount,
        totalBookings,
        confirmedCount,
        checkedInCount,
        cancelledCount,
        todayBookingsCount: todayBookings.length,
      },
      roomUtilization: Object.values(roomUtilizationMap),
      hourlyDistribution: Object.entries(hourlyDistribution).map(([hour, count]) => ({
        hour: `${hour.padStart(2, "0")}:00`,
        count,
      })),
      departmentUsage: Object.entries(departmentUsage).map(([department, count]) => ({
        department,
        count,
      })),
      todaySchedule: todayBookings,
    });
  } catch (error) {
    console.error("Error generating analytics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate analytics" },
      { status: 500 }
    );
  }
}
