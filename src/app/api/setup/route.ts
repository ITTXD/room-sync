import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const [orgCount, userCount, roomCount, bookingCount] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.room.count(),
      prisma.booking.count(),
    ]);

    return NextResponse.json({
      success: true,
      isClean: roomCount === 0 && userCount === 0,
      stats: {
        orgCount,
        userCount,
        roomCount,
        bookingCount,
      },
    });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check setup status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      orgName = "Workspace Hub",
      adminName = "Admin User",
      adminEmail = "admin@workspace.local",
      department = "Management",
    } = body;

    // 1. Create or get organization
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: orgName,
          slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          openTime: "08:00",
          closeTime: "20:00",
        },
      });
    }

    // 2. Create the real Admin user
    let user = await prisma.user.findFirst({ where: { email: adminEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          role: "ADMIN",
          department,
          organizationId: org.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Workspace and Admin created successfully.",
      user,
      organization: org,
    });
  } catch (error) {
    console.error("Workspace initialization error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initialize workspace" },
      { status: 500 }
    );
  }
}
