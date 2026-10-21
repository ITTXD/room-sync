import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { CreateRoomSchema } from "@/lib/validations";
import { ensureDefaultWorkspace } from "@/lib/booking-engine";

export async function GET(request: NextRequest) {
  try {
    await ensureDefaultWorkspace();

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") === "true";
    const minCapacity = searchParams.get("minCapacity");
    const search = searchParams.get("search");

    const rooms = await prisma.room.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(minCapacity ? { capacity: { gte: parseInt(minCapacity, 10) } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { floor: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            bookings: {
              where: { status: { not: "CANCELLED" } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedRooms = rooms.map((room) => ({
      ...room,
      amenities: JSON.parse(room.amenitiesJson || "[]") as string[],
      totalActiveBookings: room._count.bookings,
    }));

    return NextResponse.json({
      success: true,
      count: formattedRooms.length,
      rooms: formattedRooms,
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const defaultOrg = await ensureDefaultWorkspace();
    const body = await request.json();
    const validated = CreateRoomSchema.safeParse(body);

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

    const { amenities, organizationId, ...rest } = validated.data;

    // Verify organization exists or fallback to defaultOrg.id
    let targetOrgId = defaultOrg.id;
    if (organizationId) {
      const foundOrg = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (foundOrg) {
        targetOrgId = foundOrg.id;
      }
    }

    const newRoom = await prisma.room.create({
      data: {
        ...rest,
        organizationId: targetOrgId,
        amenitiesJson: JSON.stringify(amenities),
      },
    });

    return NextResponse.json(
      {
        success: true,
        room: {
          ...newRoom,
          amenities,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create room" },
      { status: 500 }
    );
  }
}
