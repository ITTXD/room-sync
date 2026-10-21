import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LoginSchema } from "@/lib/validations";
import {
  verifyPassword,
  verifyTotpCode,
  signPreAuthToken,
  createSessionAndSetCookie,
  checkRateLimit,
  resetRateLimit,
  extractRequestMeta,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const meta = extractRequestMeta(request);
    const ipRateCheck = checkRateLimit(`login_ip:${meta.ipAddress}`, 15, 5 * 60 * 1000);
    if (!ipRateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many login requests from your IP. Please wait ${ipRateCheck.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid login payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password, totpCode } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const emailRateCheck = checkRateLimit(`login_acc:${normalizedEmail}`, 6, 5 * 60 * 1000);
    if (!emailRateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Account temporarily locked due to too many failed attempts. Try again in ${emailRateCheck.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Two-factor authentication check
    if (user.totpEnabled) {
      if (!totpCode) {
        const preAuthToken = await signPreAuthToken(user.id);
        return NextResponse.json({
          requiresTwoFactor: true,
          preAuthToken,
          message: "Please enter your 6-digit Google Authenticator code.",
        });
      }

      if (!user.totpSecret || !verifyTotpCode(user.totpSecret, totpCode)) {
        return NextResponse.json(
          { error: "Invalid 6-digit authenticator code" },
          { status: 401 }
        );
      }
    }

    // Reset rate limiters on successful authentication
    resetRateLimit(`login_acc:${normalizedEmail}`);
    resetRateLimit(`login_ip:${meta.ipAddress}`);

    await createSessionAndSetCookie(user.id, user.role, request);

    return NextResponse.json({
      message: "Authentication successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        avatarUrl: user.avatarUrl,
        totpEnabled: user.totpEnabled,
      },
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
