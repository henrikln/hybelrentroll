import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Use DIRECT_URL (port 5432) for pg adapter — DATABASE_URL uses PgBouncer (port 6543)
  // which is incompatible with the pg driver adapter
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

  // Debug: log which env var is used and the host (redacted)
  const host = connectionString ? new URL(connectionString).host : "EMPTY";
  console.log(`[db] using ${process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL"}, host=${host}`);

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
