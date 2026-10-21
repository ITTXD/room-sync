import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionAndSetCookie } from "@/lib/auth";
import { ensureDefaultWorkspace } from "@/lib/booking-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body; // "google" | "github"

    if (provider !== "google" && provider !== "github") {
      return NextResponse.json(
        { error: "Unsupported OAuth provider" },
        { status: 400 }
      );
    }

    await ensureDefaultWorkspace();
    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json(
        { error: "Workspace organization missing" },
        { status: 500 }
      );
    }

    // Default SSO profiles for seamless local demo and portfolio review
    const ssoProfile =
      provider === "google"
        ? {
            name: "Alex Vance (Google)",
            email: "alex.vance@company.com",
            department: "Product Design",
            avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=AlexGoogle",
            role: "MEMBER",
          }
        : {
            name: "Devon Reed (GitHub)",
            email: "devon.reed@octocat.io",
            department: "Engineering",
            avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=DevonGitHub",
            role: "ADMIN",
          };

    let user = await prisma.user.findUnique({
      where: { email: ssoProfile.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: ssoProfile.name,
          email: ssoProfile.email,
          role: ssoProfile.role,
          department: ssoProfile.department,
          avatarUrl: ssoProfile.avatarUrl,
          organizationId: org.id,
          authProvider: provider.toUpperCase(),
        },
      });
    }

    await createSessionAndSetCookie(user.id, user.role, request);

    return NextResponse.json({
      message: `Signed in with ${provider.toUpperCase()}`,
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
    console.error("OAuth Error:", error);
    return NextResponse.json(
      { error: "OAuth sign-in failed" },
      { status: 500 }
    );
  }
}
