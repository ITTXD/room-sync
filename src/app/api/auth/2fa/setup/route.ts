import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getCurrentSessionUser,
  generateTotpSecret,
  buildOtpAuthUri,
} from "@/lib/auth";

export async function POST() {
  try {
    const sessionData = await getCurrentSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = generateTotpSecret(20);
    const otpAuthUri = buildOtpAuthUri(sessionData.user.email, secret, "RoomSync");

    // Temporarily save secret to user so verify can check it before enabling
    await prisma.user.update({
      where: { id: sessionData.user.id },
      data: { totpSecret: secret },
    });

    return NextResponse.json({
      secret,
      otpAuthUri,
      issuer: "RoomSync",
      account: sessionData.user.email,
    });
  } catch (error: any) {
    console.error("2FA Setup error:", error);
    return NextResponse.json(
      { error: "Failed to initiate 2FA setup" },
      { status: 500 }
    );
  }
}
