import { NextRequest, NextResponse } from "next/server";
import { getRoomTimeline } from "@/lib/booking-engine";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    const minCapacityParam = searchParams.get("minCapacity");
    const amenityParam = searchParams.get("amenity");

    // Default to today if date not provided
    const targetDate = dateParam || new Date().toISOString().split("T")[0];

    const allRooms = await getRoomTimeline(targetDate);

    // Apply optional filters
    let filteredRooms = allRooms;

    if (minCapacityParam) {
      const minCap = parseInt(minCapacityParam, 10);
      if (!isNaN(minCap)) {
        filteredRooms = filteredRooms.filter((r) => r.capacity >= minCap);
      }
    }

    if (amenityParam) {
      filteredRooms = filteredRooms.filter((r) =>
        r.amenities.some((a) => a.toLowerCase().includes(amenityParam.toLowerCase()))
      );
    }

    const totalBookings = filteredRooms.reduce(
      (sum, room) => sum + room.bookings.length,
      0
    );

    return NextResponse.json({
      success: true,
      date: targetDate,
      summary: {
        totalRooms: filteredRooms.length,
        totalBookings,
      },
      rooms: filteredRooms,
    });
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch timeline data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
