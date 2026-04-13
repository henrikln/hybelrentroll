import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === "number") return d;
  return d.toNumber();
}

type Snapshot = Awaited<ReturnType<typeof getSnapshotData>> extends infer T
  ? T extends { snapshots: infer S }
    ? S extends (infer U)[]
      ? U
      : never
    : never
  : never;

export interface SnapshotUnit {
  id: string;
  unitNumber: string;
  unitType: string;
  areaSqm: number;
  floor: number | null;
  status: string;
  leaseholderName: string | null;
  leaseholderEmail: string | null;
  leaseholderPhone: string | null;
  monthlyRent: number;
  contractType: string | null;
  startDate: Date | null;
  endDate: Date | null;
  companyId: string;
  companyName: string;
  companyOrgNumber: string;
  streetName: string;
  streetNumber: string;
  postalCode: string;
  postalPlace: string;
  gnr: number | null;
  bnr: number | null;
  customNumber: string | null;
  externalContractId: string | null;
}

/**
 * Get snapshot-based data for a given account and optional period.
 * If period is null, returns data from the latest report date.
 * Returns null if no snapshots exist.
 */
export async function getSnapshotData(
  accountId: string,
  period: string | null
) {
  let reportDate: Date | null = null;

  if (period) {
    reportDate = new Date(period);
  } else {
    const latest = await prisma.rentRollSnapshot.findFirst({
      where: { company: { accountId } },
      orderBy: { reportDate: "desc" },
      select: { reportDate: true },
    });
    reportDate = latest?.reportDate ?? null;
  }

  if (!reportDate) return null;

  const snapshots = await prisma.rentRollSnapshot.findMany({
    where: {
      company: { accountId },
      reportDate,
    },
    include: {
      company: { select: { id: true, name: true, orgNumber: true } },
    },
  });

  return { reportDate, snapshots };
}

/**
 * Convert raw snapshots into normalized SnapshotUnit array.
 */
export function normalizeSnapshots(
  snapshots: NonNullable<Awaited<ReturnType<typeof getSnapshotData>>>
): SnapshotUnit[] {
  return snapshots.snapshots.map((s) => ({
    id: s.id,
    unitNumber: s.unitNumber || s.customNumber || "—",
    unitType: s.unitType,
    areaSqm: toNum(s.areaSqm),
    floor: s.floor,
    status: s.status ?? "ledig",
    leaseholderName: s.leaseholderName,
    leaseholderEmail: s.leaseholderEmail,
    leaseholderPhone: s.leaseholderPhone,
    monthlyRent: toNum(s.monthlyRent),
    contractType: s.contractType,
    startDate: s.startDate,
    endDate: s.endDate,
    companyId: s.company.id,
    companyName: s.company.name,
    companyOrgNumber: s.company.orgNumber,
    streetName: s.streetName,
    streetNumber: s.streetNumber,
    postalCode: s.postalCode,
    postalPlace: s.postalPlace,
    gnr: s.gnr,
    bnr: s.bnr,
    customNumber: s.customNumber,
    externalContractId: s.externalContractId,
  }));
}
