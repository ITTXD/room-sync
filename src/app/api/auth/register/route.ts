import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RegisterSchema } from "@/lib/validations";
import {
  hashPassword,
  createSessionAndSetCookie,
  checkRateLimit,
  extractRequestMeta,
} from "@/lib/auth";
import { ensureDefaultWorkspace } from "@/lib/booking-engine";

export async function POST(request: NextRequest) {
  try {
    const meta = extractRequestMeta(request);
    const rateCheck = checkRateLimit(`register:${meta.ipAddress}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many registration attempts. Please wait ${rateCheck.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, password, role, department, avatarUrl } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Ensure organization exists
    await ensureDefaultWorkspace();
    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json(
        { error: "Workspace organization could not be initialized" },
        { status: 500 }
      );
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password securely with scrypt
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        department: department?.trim() || "General",
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        organizationId: org.id,
        authProvider: "CREDENTIALS",
      },
    });

    // Create session and set HttpOnly cookie
    await createSessionAndSetCookie(user.id, user.role, request);

    return NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          avatarUrl: user.avatarUrl,
          totpEnabled: user.totpEnabled,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { error: "Failed to register user account" },
      { status: 500 }
    );
  }
}
