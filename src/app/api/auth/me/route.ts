import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";

export async function GET() {
  const sessionData = await getCurrentSessionUser();
  if (!sessionData) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: sessionData.user,
    sessionId: sessionData.sessionId,
  });
}
