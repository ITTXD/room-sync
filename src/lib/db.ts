import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let cachedClient: PrismaClient | null = null;
let cachedConnStr: string | null = null;

function getConnectionString(): string {
  try {
    // Dynamic import / require to prevent errors outside Cloudflare Workers
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    if (ctx?.env?.HYPERDRIVE?.connectionString) {
      return ctx.env.HYPERDRIVE.connectionString;
    }
    if (ctx?.env?.DATABASE_URL) {
      return ctx.env.DATABASE_URL;
    }
  } catch {
    // Running in local Node.js or build script
  }

  return process.env.DATABASE_URL || "";
}

export function getPrisma(): PrismaClient {
  const connStr = getConnectionString();

  if (cachedClient && cachedConnStr === connStr) {
    return cachedClient;
  }

  if (connStr && !connStr.startsWith("file:")) {
    const isLocal = connStr.includes("localhost") || connStr.includes("127.0.0.1");
    const pool = new Pool({
      connectionString: connStr,
      max: 1,
      maxUses: 1,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });

    const adapter = new PrismaPg(pool);
    cachedClient = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    cachedConnStr = connStr;
    return cachedClient;
  }

  cachedClient = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  cachedConnStr = connStr;
  return cachedClient;
}

// Proxy wrapper so existing calls like `prisma.room.findMany()` work transparently
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});

export default prisma;
