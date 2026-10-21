/**
 * Supabase Migration & Verification Script
 * Run via: npx tsx scripts/setup-supabase.ts
 */

import { execSync } from "node:child_process";
import prisma from "../src/lib/db";
import { ensureDefaultWorkspace } from "../src/lib/booking-engine";

async function main() {
  console.log("\n=================================================");
  console.log("🚀 Supabase PostgreSQL Migration & Verification");
  console.log("=================================================\n");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) {
    console.error("❌ Error: DATABASE_URL is not set to a PostgreSQL URL!");
    console.error("Please configure your Supabase connection string in .env");
    process.exit(1);
  }

  console.log("1. Generating Prisma Client for PostgreSQL...");
  execSync("npx prisma generate", { stdio: "inherit" });

  console.log("\n2. Pushing Prisma Schema to Supabase Database...");
  execSync("npx prisma db push", { stdio: "inherit" });

  console.log("\n3. Seeding default workspace, meeting rooms, and admin accounts...");
  await ensureDefaultWorkspace();

  console.log("\n4. Verifying database connection and records...");
  const rooms = await prisma.room.findMany();
  const users = await prisma.user.findMany();

  console.log(`✅ Success! Connected to Supabase.`);
  console.log(`   - Rooms available: ${rooms.length} (${rooms.map((r) => r.name).join(", ")})`);
  console.log(`   - Seeded users: ${users.length} (${users.map((u) => u.email).join(", ")})`);

  console.log("\n✨ Supabase is 100% ready for Cloudflare deployment!\n");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
