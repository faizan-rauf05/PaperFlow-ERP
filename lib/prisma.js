import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { getDatabaseUrl } from "@/lib/databaseUrl";

const globalForPrisma = globalThis;

function createPrismaClient() {
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL or PRISMA_URL must be set");
  }

  const pool = new pg.Pool({
    connectionString,
    // Neon's pooled endpoint closes idle connections server-side; recycle
    // clients here well before that so `pg` doesn't hand Prisma a socket
    // the server already dropped (surfaces as P1017 "server has closed
    // the connection" after any period of inactivity, e.g. dev sitting idle).
    idleTimeoutMillis: 10_000,
    max: 10,
  });
  pool.on("error", (err) => {
    console.error("Unexpected pg pool error (idle client):", err);
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
