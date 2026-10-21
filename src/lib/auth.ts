import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

export const SESSION_COOKIE_NAME = "roomsync_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    "roomsync-enterprise-hmac-sha256-secret-key-2026-secure";
  return new TextEncoder().encode(secret);
}

// ============================================================================
// 1. Cryptographic Password Hashing (node:crypto scrypt + timingSafeEqual)
// ============================================================================

// Scrypt configuration: N=16384 (CPU/memory cost), r=8 (block size), p=1 (parallelization)
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

// Dummy salt & key buffer used to equalize timing when supplied hashes are malformed
const DUMMY_SALT = "00".repeat(32);
const DUMMY_KEY = Buffer.alloc(64);

export async function hashPassword(password: string): Promise<string> {
  // Use 32 bytes (256-bit entropy) for maximum resistance to rainbow tables
  const salt = crypto.randomBytes(32).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT_OPTIONS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash || typeof storedHash !== "string" || !storedHash.includes(":")) {
    // Run dummy computation to resist timing analysis attacks
    await new Promise<Buffer>((resolve) => {
      crypto.scrypt(password || "dummy", DUMMY_SALT, 64, SCRYPT_OPTIONS, (_, key) => {
        resolve(key || DUMMY_KEY);
      });
    });
    return false;
  }

  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;

  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT_OPTIONS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  if (keyBuffer.length !== derivedKey.length) {
    // Run dummy timing check to equalize execution path
    crypto.timingSafeEqual(derivedKey, derivedKey);
    return false;
  }

  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// ============================================================================
// Safe User Selection & Credential Sanitization
// ============================================================================

/**
 * Standard Prisma User projection that excludes all sensitive credential fields
 * (never contains passwordHash or totpSecret).
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  avatarUrl: true,
  totpEnabled: true,
  authProvider: true,
  organizationId: true,
  createdAt: true,
} as const;

/**
 * Utility to strip passwordHash, totpSecret, and internal secrets from any User object.
 */
export function stripSensitiveUserFields<T extends Record<string, any>>(
  user: T
): Omit<T, "passwordHash" | "totpSecret"> {
  if (!user) return user;
  const { passwordHash, totpSecret, ...safeUser } = user;
  return safeUser as Omit<T, "passwordHash" | "totpSecret">;
}

// ============================================================================
// 2. RFC 6238 TOTP (Google Authenticator / Microsoft Authenticator / Authy)
// ============================================================================

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

export function buildOtpAuthUri(
  email: string,
  secret: string,
  issuer = "RoomSync"
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateTotpCodeAtStep(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  window = 1
): boolean {
  const cleanCode = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const expected = generateTotpCodeAtStep(secret, currentStep + errorWindow);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(cleanCode, "utf8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// 3. JWT & Pre-Auth Challenge Tokens (jose HS256)
// ============================================================================

export interface SessionJwtPayload {
  sessionId: string;
  userId: string;
  role: string;
}

export async function signSessionJwt(payload: SessionJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey());
}

export async function verifySessionJwt(
  token: string
): Promise<SessionJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (
      typeof payload.sessionId === "string" &&
      typeof payload.userId === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        sessionId: payload.sessionId,
        userId: payload.userId,
        role: payload.role,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signPreAuthToken(userId: string): Promise<string> {
  return new SignJWT({ userId, stage: "2fa_pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getJwtSecretKey());
}

export async function verifyPreAuthToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (
      payload.stage === "2fa_pending" &&
      typeof payload.userId === "string"
    ) {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// 4. Stateful Database Session & Cookie Management
// ============================================================================

export function extractRequestMeta(req?: Request): {
  ipAddress: string;
  userAgent: string;
} {
  if (!req) {
    return { ipAddress: "127.0.0.1", userAgent: "RoomSync Web Client" };
  }
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : req.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "RoomSync Browser";
  return { ipAddress, userAgent };
}

export async function createSessionAndSetCookie(
  userId: string,
  role: string,
  req?: Request
) {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  const jwt = await signSessionJwt({
    sessionId: session.id,
    userId,
    role,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function getCurrentSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionJwt(token);
    if (!payload) return null;

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    const { passwordHash, totpSecret, ...safeUser } = session.user;
    return {
      user: {
        ...safeUser,
        hasPassword: Boolean(passwordHash),
      },
      sessionId: session.id,
    };
  } catch {
    return null;
  }
}

export async function destroyCurrentSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const payload = await verifySessionJwt(token);
      if (payload?.sessionId) {
        await prisma.session
          .delete({ where: { id: payload.sessionId } })
          .catch(() => {});
      }
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignore cookie deletion errors
  }
}

// ============================================================================
// 5. Brute-Force Rate Limiter
// ============================================================================

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateBucket>();

export function checkRateLimit(
  key: string,
  maxAttempts = 8,
  windowMs = 5 * 60 * 1000
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string) {
  rateLimitStore.delete(key);
}
