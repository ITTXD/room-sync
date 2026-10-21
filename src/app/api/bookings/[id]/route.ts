import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { UpdateBookingSchema } from "@/lib/validations";
import { ensureDefaultWorkspace } from "@/lib/booking-engine";
import { SAFE_USER_SELECT } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDefaultWorkspace();
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id }, { accessCode: id }],
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
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        room: {
          ...booking.room,
          amenities: JSON.parse(booking.room.amenitiesJson || "[]") as string[],
        },
      },
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validated = UpdateBookingSchema.safeParse(body);
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

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: validated.data,
      include: {
        room: true,
        user: { select: { id: true, name: true, email: true } },
        participants: {
          where: { status: "CHECKED_IN" },
          orderBy: { checkedInAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Booking updated successfully to status: ${updatedBooking.status}`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update booking" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft cancel instead of hard delete to preserve history
    const cancelled = await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({
      success: true,
      message: "Booking successfully cancelled",
      booking: cancelled,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}
