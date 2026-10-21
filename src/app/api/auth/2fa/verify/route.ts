import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyTotpCode,
  verifyPreAuthToken,
  getCurrentSessionUser,
  createSessionAndSetCookie,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, preAuthToken, action } = body;

    // Mode A: Complete login with preAuthToken + TOTP code
    if (preAuthToken) {
      if (!code || !/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: "A valid 6-digit authenticator code is required" },
          { status: 400 }
        );
      }

      const preAuth = await verifyPreAuthToken(preAuthToken);
      if (!preAuth) {
        return NextResponse.json(
          { error: "2FA challenge session expired. Please sign in again." },
          { status: 401 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: preAuth.userId },
      });

      if (!user || !user.totpSecret) {
        return NextResponse.json(
          { error: "User 2FA configuration not found" },
          { status: 400 }
        );
      }

      const isValid = verifyTotpCode(user.totpSecret, code);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid authenticator code. Check your device time and code." },
          { status: 401 }
        );
      }

      await createSessionAndSetCookie(user.id, user.role, request);

      return NextResponse.json({
        message: "2FA verified and logged in successfully",
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
    }

    // Mode B: Active session user managing their 2FA
    const sessionData = await getCurrentSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Sub-mode: Disable 2FA
    if (action === "disable") {
      if (!user.totpEnabled) {
        return NextResponse.json(
          { message: "Two-factor authentication is already disabled" }
        );
      }

      // Verify code before allowing disable
      if (!code || !user.totpSecret || !verifyTotpCode(user.totpSecret, code)) {
        return NextResponse.json(
          { error: "Please enter a valid code from your authenticator app to disable 2FA" },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          totpEnabled: false,
          totpSecret: null,
        },
      });

      return NextResponse.json({
        message: "Two-factor authentication has been disabled",
        totpEnabled: false,
      });
    }

    // Sub-mode: Enable 2FA after scanning QR Code
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the 6-digit code shown in Google Authenticator" },
        { status: 400 }
      );
    }

    if (!user.totpSecret) {
      return NextResponse.json(
        { error: "No 2FA setup in progress. Please start setup again." },
        { status: 400 }
      );
    }

    const isValid = verifyTotpCode(user.totpSecret, code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid code. Please ensure the code is current and your phone clock is accurate." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
      },
    });

    return NextResponse.json({
      message: "Two-factor authentication has been successfully enabled!",
      totpEnabled: true,
    });
  } catch (error: any) {
    console.error("2FA verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify 2FA code" },
      { status: 500 }
    );
  }
}
