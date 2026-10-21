import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { CreateBookingSchema } from "@/lib/validations";
import { createSafeBooking, ensureDefaultWorkspace } from "@/lib/booking-engine";
import { SAFE_USER_SELECT, stripSensitiveUserFields } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await ensureDefaultWorkspace();

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const roomId = searchParams.get("roomId");
    const status = searchParams.get("status");
    const accessCode = searchParams.get("accessCode");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const bookings = await prisma.booking.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(roomId ? { roomId } : {}),
        ...(status ? { status } : {}),
        ...(accessCode ? { accessCode } : {}),
      },
      include: {
        room: true,
        user: {
          select: SAFE_USER_SELECT,
        },
        participants: {
          where: { status: "CHECKED_IN" },
          orderBy: { checkedInAt: "asc" },
        },
      },
      orderBy: { startTime: "desc" },
      take: Math.min(limit, 100),
    });

    const formatted = bookings.map((b) => ({
      ...b,
      room: {
        ...b.room,
        amenities: JSON.parse(b.room.amenitiesJson || "[]") as string[],
      },
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      bookings: formatted,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateBookingSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const booking = await createSafeBooking(validated.data);

    return NextResponse.json(
      {
        success: true,
        message: "Booking successfully confirmed",
        booking: {
          ...booking,
          user: stripSensitiveUserFields(booking.user),
          room: {
            ...booking.room,
            amenities: JSON.parse(booking.room.amenitiesJson || "[]") as string[],
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Booking creation error:", message);

    const isConflict =
      message.includes("conflict") ||
      message.includes("exceeds room capacity") ||
      message.includes("maintenance");

    return NextResponse.json(
      {
        success: false,
        error: isConflict ? "Conflict or Room Unavailable" : "Failed to create booking",
        message,
      },
      { status: isConflict ? 409 : 500 }
    );
  }
}
