import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Use DIRECT_URL (port 5432) for pg adapter — DATABASE_URL uses PgBouncer (port 6543)
  // which is incompatible with the pg driver adapter
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

  // Debug: log which env var is used (only in development)
  if (process.env.NODE_ENV !== "production") {
    const host = connectionString ? new URL(connectionString).host : "EMPTY";
    console.log(`[db] using ${process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL"}, host=${host}`);
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Set the RLS session variable for the current account.
 * Must be called inside a Prisma interactive transaction (`prisma.$transaction`)
 * — `SET LOCAL` scopes the variable to the current transaction only.
 *
 * Usage:
 *   await prisma.$transaction(async (tx) => {
 *     await setRLSAccountId(tx, accountId);
 *     // ... all queries in tx are now RLS-scoped
 *   });
 *
 * For non-transactional contexts (most read paths), use `setRLSContext(accountId)`
 * which sets it for the session/connection lifetime.
 */
export async function setRLSAccountId(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  accountId: string
) {
  await tx.$executeRaw`SELECT set_config('app.current_account_id', ${accountId}, true)`;
}

/**
 * Set the RLS context for the current connection (non-transactional).
 * Uses SET (not SET LOCAL) so it persists for all queries on this connection
 * until overwritten. Safe in serverless because each request gets a fresh connection.
 */
export async function setRLSContext(accountId: string) {
  await prisma.$executeRaw`SELECT set_config('app.current_account_id', ${accountId}, false)`;
}
