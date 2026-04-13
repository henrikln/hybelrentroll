import { prisma } from "@/lib/db";

/**
 * Get snapshot-based data for a given account and optional period.
 * If period is null, returns data from the latest report date.
 * Returns null if no snapshots exist.
 */
export async function getSnapshotData(
  accountId: string,
  period: string | null
) {
  // Determine the target report date
  let reportDate: Date | null = null;

  if (period) {
    reportDate = new Date(period);
  } else {
    // Find the latest report date for this account
    const latest = await prisma.rentRollSnapshot.findFirst({
      where: { company: { accountId } },
      orderBy: { reportDate: "desc" },
      select: { reportDate: true },
    });
    reportDate = latest?.reportDate ?? null;
  }

  if (!reportDate) return null;

  // Get all snapshots for this account at this report date
  const snapshots = await prisma.rentRollSnapshot.findMany({
    where: {
      company: { accountId },
      reportDate,
    },
    include: {
      company: { select: { id: true, name: true } },
    },
  });

  return { reportDate, snapshots };
}
