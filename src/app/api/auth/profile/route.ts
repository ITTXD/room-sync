import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { UpdateProfileSchema } from "@/lib/validations";

export async function PATCH(request: NextRequest) {
  try {
    const sessionData = await getCurrentSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid update data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      name,
      role,
      department,
      avatarUrl,
      currentPassword,
      newPassword,
    } = parsed.data;

    const userInDb = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
    });

    if (!userInDb) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (name) updateData.name = name.trim();
    if (role) updateData.role = role;
    if (department !== undefined) updateData.department = department?.trim() || null;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    // Handle password change if requested
    if (newPassword) {
      if (userInDb.passwordHash) {
        if (!currentPassword) {
          return NextResponse.json(
            { error: "Current password is required to set a new password" },
            { status: 400 }
          );
        }
        const matches = await verifyPassword(currentPassword, userInDb.passwordHash);
        if (!matches) {
          return NextResponse.json(
            { error: "Current password does not match" },
            { status: 400 }
          );
        }
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userInDb.id },
      data: updateData,
    });

    const { passwordHash, totpSecret, ...safeUser } = updatedUser;

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        ...safeUser,
        hasPassword: Boolean(updatedUser.passwordHash),
      },
    });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
