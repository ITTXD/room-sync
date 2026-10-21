import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { UpdateRoomSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        bookings: {
          where: {
            status: { not: "CANCELLED" },
            endTime: { gte: new Date() },
          },
          include: {
            user: { select: { id: true, name: true, department: true } },
          },
          orderBy: { startTime: "asc" },
          take: 10,
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      room: {
        ...room,
        amenities: JSON.parse(room.amenitiesJson || "[]") as string[],
      },
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch room details" },
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
    const validated = UpdateRoomSchema.safeParse(body);

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

    const { amenities, ...rest } = validated.data;

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: {
        ...rest,
        ...(amenities !== undefined
          ? { amenitiesJson: JSON.stringify(amenities) }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      room: {
        ...updatedRoom,
        amenities: JSON.parse(updatedRoom.amenitiesJson || "[]") as string[],
      },
    });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update room" },
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

    await prisma.room.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete room" },
      { status: 500 }
    );
  }
}
