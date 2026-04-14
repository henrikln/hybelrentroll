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
 * Uses PostgreSQL DISTINCT ON to deduplicate at the DB level — only the
 * latest snapshot per (company_id, unit_key) is returned.
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

  // Use DISTINCT ON to deduplicate at DB level — keeps only the latest
  // snapshot per (company_id, unit_key), avoiding fetching all duplicates.
  const snapshotIds = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT ON (s.company_id, s.unit_key) s.id
    FROM rent_roll_snapshots s
    JOIN companies c ON c.id = s.company_id
    WHERE c.account_id = ${accountId}::uuid
      AND s.report_date = ${reportDate}
    ORDER BY s.company_id, s.unit_key, s.created_at DESC, s.id DESC
  `;

  if (snapshotIds.length === 0) {
    return { reportDate, snapshots: [] };
  }

  const snapshots = await prisma.rentRollSnapshot.findMany({
    where: { id: { in: snapshotIds.map((r) => r.id) } },
    include: {
      company: { select: { id: true, name: true, orgNumber: true } },
    },
  });

  return { reportDate, snapshots };
}

/**
 * Get all distinct report dates for an account, ordered descending.
 * Useful for period selectors and trend calculations.
 */
export async function getReportDates(accountId: string): Promise<Date[]> {
  const rows = await prisma.$queryRaw<Array<{ report_date: Date }>>`
    SELECT DISTINCT s.report_date
    FROM rent_roll_snapshots s
    JOIN companies c ON c.id = s.company_id
    WHERE c.account_id = ${accountId}::uuid
    ORDER BY s.report_date DESC
  `;
  return rows.map((r) => r.report_date);
}

/** Aggregate helpers for SnapshotUnit arrays */
export function aggregateUnits(units: SnapshotUnit[]) {
  const totalUnits = units.length;
  const vacantUnits = units.filter(
    (u) => !u.status || u.status === "ledig"
  ).length;
  const annualizedRent = units.reduce(
    (sum, u) => sum + u.monthlyRent * 12,
    0
  );
  const totalArea = units.reduce((sum, u) => sum + u.areaSqm, 0);
  return { totalUnits, vacantUnits, annualizedRent, totalArea };
}

/** Group snapshot units by company+address into property buckets */
export function groupByProperty(units: SnapshotUnit[]) {
  const map = new Map<string, { first: SnapshotUnit; units: SnapshotUnit[] }>();
  for (const u of units) {
    const key = `${u.companyId}_${u.streetName} ${u.streetNumber}`;
    if (!map.has(key)) {
      map.set(key, { first: u, units: [] });
    }
    map.get(key)!.units.push(u);
  }
  return map;
}

/** Group snapshot units by companyId */
export function groupByCompany(units: SnapshotUnit[]) {
  const map = new Map<string, { first: SnapshotUnit; units: SnapshotUnit[]; addresses: Set<string> }>();
  for (const u of units) {
    if (!map.has(u.companyId)) {
      map.set(u.companyId, { first: u, units: [], addresses: new Set() });
    }
    const entry = map.get(u.companyId)!;
    entry.units.push(u);
    entry.addresses.add(`${u.streetName} ${u.streetNumber}`);
  }
  return map;
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
