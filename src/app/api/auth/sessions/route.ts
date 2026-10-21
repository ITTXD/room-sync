import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth";

export async function GET() {
  const sessionData = await getCurrentSessionUser();
  if (!sessionData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId: sessionData.user.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress || "Unknown IP",
    userAgent: s.userAgent || "Unknown Device",
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.id === sessionData.sessionId,
  }));

  return NextResponse.json({ sessions: formatted });
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionData = await getCurrentSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetSessionId = searchParams.get("id");
    const revokeOthers = searchParams.get("revokeOthers") === "true";

    if (revokeOthers) {
      await prisma.session.deleteMany({
        where: {
          userId: sessionData.user.id,
          id: { not: sessionData.sessionId },
        },
      });
      return NextResponse.json({ message: "All other sessions revoked" });
    }

    if (!targetSessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const session = await prisma.session.findFirst({
      where: { id: targetSessionId, userId: sessionData.user.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await prisma.session.delete({ where: { id: targetSessionId } });

    return NextResponse.json({ message: "Session revoked successfully" });
  } catch (error: any) {
    console.error("Session delete error:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
}
