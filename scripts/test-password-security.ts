/**
 * TDD Security Test Suite: Password Hashing & Credential Leakage Prevention
 * Run via: npx tsx scripts/test-password-security.ts
 */

import { hashPassword, verifyPassword, SAFE_USER_SELECT, stripSensitiveUserFields } from "../src/lib/auth";
import { createSafeBooking, ensureDefaultWorkspace } from "../src/lib/booking-engine";
import prisma from "../src/lib/db";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("🔒 TDD Suite: Password Hashing & Credential Security");
  console.log("=======================================================\n");

  // --------------------------------------------------------------------------
  // TEST 1: Password Hash & Verification Accuracy
  // --------------------------------------------------------------------------
  console.log("Test 1: Password Hash & Verification Accuracy");
  const rawPassword = "CorrectHorseBatteryStaple123!";
  const hash = await hashPassword(rawPassword);

  assert(typeof hash === "string" && hash.includes(":"), "hashPassword generates format 'salt:hash'");
  const isMatch = await verifyPassword(rawPassword, hash);
  assert(isMatch === true, "verifyPassword returns true for correct password");

  const isWrongMatch = await verifyPassword("WrongPassword123!", hash);
  assert(isWrongMatch === false, "verifyPassword returns false for incorrect password");

  // --------------------------------------------------------------------------
  // TEST 2: Salt Entropy & Length (32 bytes = 64 hex chars)
  // --------------------------------------------------------------------------
  console.log("\nTest 2: Salt Entropy & Length (Target: 32 bytes = 64 hex chars)");
  const [salt, derivedKeyHex] = hash.split(":");
  assert(salt.length === 64, `Salt length is 64 hex chars (32 bytes). Actual length: ${salt.length}`);
  assert(derivedKeyHex.length === 128, `Derived key length is 128 hex chars (64 bytes). Actual length: ${derivedKeyHex.length}`);

  // --------------------------------------------------------------------------
  // TEST 3: Timing Attack & Malformed Hash Resilience
  // --------------------------------------------------------------------------
  console.log("\nTest 3: Timing Attack & Malformed Hash Resilience");
  const malformed1 = await verifyPassword(rawPassword, "");
  assert(malformed1 === false, "Handles empty hash safely without crashing");

  const malformed2 = await verifyPassword(rawPassword, "nosaltatall");
  assert(malformed2 === false, "Handles missing colon safely");

  const malformed3 = await verifyPassword(rawPassword, "abcd:1234");
  assert(malformed3 === false, "Handles invalid hex or mismatched length safely");

  // --------------------------------------------------------------------------
  // TEST 4: Safe User Projection & Sanitization Utility
  // --------------------------------------------------------------------------
  console.log("\nTest 4: Safe User Projection & Sanitization Utility");
  assert(!("passwordHash" in SAFE_USER_SELECT), "SAFE_USER_SELECT must NOT contain passwordHash");
  assert(!("totpSecret" in SAFE_USER_SELECT), "SAFE_USER_SELECT must NOT contain totpSecret");

  const mockUserWithSecrets = {
    id: "usr_test123",
    name: "Alice Tester",
    email: "alice@test.com",
    passwordHash: "secret_salt:secret_hash",
    totpSecret: "JBSWY3DPEHPK3PXP",
    role: "MEMBER",
  };

  const sanitized = stripSensitiveUserFields(mockUserWithSecrets);
  const sanitizedRecord = sanitized as Record<string, unknown>;
  assert(sanitizedRecord.passwordHash === undefined, "stripSensitiveUserFields removes passwordHash");
  assert(sanitizedRecord.totpSecret === undefined, "stripSensitiveUserFields removes totpSecret");
  assert(sanitized.name === "Alice Tester", "stripSensitiveUserFields preserves safe fields");

  // --------------------------------------------------------------------------
  // TEST 5: Integration Check - Booking Engine Leaks
  // --------------------------------------------------------------------------
  console.log("\nTest 5: Integration Check - createSafeBooking Credential Leakage");
  await ensureDefaultWorkspace();
  const room = await prisma.room.findFirst({ where: { isActive: true } });
  const user = await prisma.user.findFirst();

  if (room && user) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const startIso = new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString();
    const endIso = new Date(tomorrow.setHours(15, 0, 0, 0)).toISOString();

    const createdBooking = await createSafeBooking({
      roomId: room.id,
      userId: user.id,
      title: "TDD Security Verification Booking",
      startTime: startIso,
      endTime: endIso,
      attendeeCount: 2,
      allowWalkIn: true,
    });

    const bookingUser = createdBooking.user as Record<string, unknown>;
    assert(bookingUser !== undefined, "createSafeBooking returns booking with user relation");
    assert(
      bookingUser.passwordHash === undefined,
      `createSafeBooking must NOT return passwordHash. Actual value: ${bookingUser.passwordHash}`
    );
    assert(
      bookingUser.totpSecret === undefined,
      `createSafeBooking must NOT return totpSecret. Actual value: ${bookingUser.totpSecret}`
    );

    // Clean up test booking
    await prisma.booking.delete({ where: { id: createdBooking.id } });
  } else {
    console.warn("  ⚠️ Warning: No room or user found to test createSafeBooking");
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`📊 Test Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
