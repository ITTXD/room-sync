import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ensureDefaultWorkspace } from "@/lib/booking-engine";

export async function GET() {
  try {
    await ensureDefaultWorkspace();

    const users = await prisma.user.findMany({
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: {
            bookings: {
              where: { status: { not: "CANCELLED" } },
            },
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        avatarUrl: u.avatarUrl,
        organization: u.organization,
        activeBookingsCount: u._count.bookings,
      })),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
