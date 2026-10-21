import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JoinSessionSchema } from "@/lib/validations";
import { joinBookingSession } from "@/lib/booking-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validated = JoinSessionSchema.safeParse(body);
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

    const updatedBooking = await joinBookingSession(id, validated.data);

    return NextResponse.json(
      {
        success: true,
        message: `${validated.data.name} checked into ${updatedBooking.room.name}`,
        booking: {
          ...updatedBooking,
          room: {
            ...updatedBooking.room,
            amenities: JSON.parse(updatedBooking.room.amenitiesJson || "[]") as string[],
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to join session";
    const isConflict =
      message.includes("full capacity") ||
      message.includes("already checked into") ||
      message.includes("cancelled");

    return NextResponse.json(
      {
        success: false,
        error: isConflict ? "Check-in Rejected" : "Server Error",
        message,
      },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get("participantId");

    if (!participantId) {
      return NextResponse.json(
        { success: false, error: "participantId query parameter is required" },
        { status: 400 }
      );
    }

    await prisma.bookingParticipant.update({
      where: { id: participantId },
      data: { status: "LEFT" },
    });

    const updatedBooking = await prisma.booking.findFirst({
      where: {
        OR: [{ id }, { accessCode: id }],
      },
      include: {
        room: true,
        user: { select: { id: true, name: true, department: true, avatarUrl: true } },
        participants: {
          where: { status: "CHECKED_IN" },
          orderBy: { checkedInAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Participant checked out from room",
      booking: updatedBooking
        ? {
            ...updatedBooking,
            room: {
              ...updatedBooking.room,
              amenities: JSON.parse(updatedBooking.room.amenitiesJson || "[]") as string[],
            },
          }
        : null,
    });
  } catch (error) {
    console.error("Error leaving session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check out participant" },
      { status: 500 }
    );
  }
}
