/**
 * Import orchestrator: parse Excel → create snapshots → diff → generate events.
 * Works without a database connection — stores results in memory for now.
 * When DB is connected, this will use Prisma transactions.
 */

import { parseRentRollExcel, type ParseResult } from "./parser";
import { buildUnitKey, diffSnapshots, type SnapshotData, type DetectedEvent } from "./differ";
import type { ParsedRow } from "./validators";
import { parseNorwegianDate } from "../format";

export interface SnapshotRecord {
  unitKey: string;
  reportDate: Date;
  // Property
  streetName: string;
  streetNumber: string;
  postalCode: string;
  postalPlace: string;
  gnr: number | null;
  bnr: number | null;
  unitNumber: string | null;
  customNumber: string | null;
  unitType: string;
  numRooms: number | null;
  areaSqm: number | null;
  numBedrooms: number | null;
  floor: number | null;
  // Contract
  externalContractId: string | null;
  status: string;
  contractType: string | null;
  startDate: Date | null;
  endDate: Date | null;
  noticePeriodMonths: number | null;
  earliestNoticeDate: Date | null;
  monthlyRent: number | null;
  fixedReduction: number | null;
  lastRentAdjDate: Date | null;
  nextRentAdjDate: Date | null;
  rentBeforeLastAdj: number | null;
  cpiBase: number | null;
  akontoElectricity: number | null;
  akontoWaterSewage: number | null;
  // Leaseholder
  leaseholderName: string | null;
  leaseholderEmail: string | null;
  leaseholderPhone: string | null;
  // Security
  securityType: string | null;
  securityAmount: number | null;
}

export interface ImportResult {
  orgName: string;
  orgNumber: string | null;
  reportDate: string | null;
  totalRows: number;
  parsedRows: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
  properties: string[];
  snapshots: SnapshotRecord[];
  events: DetectedEvent[];
}

/**
 * In-memory store for snapshots (per company org number).
 * In production this will be replaced by database queries.
 */
const snapshotStore = new Map<string, Map<string, SnapshotRecord>>();

function getLatestSnapshots(orgNumber: string): Map<string, SnapshotRecord> {
  return snapshotStore.get(orgNumber) ?? new Map();
}

function storeSnapshots(orgNumber: string, snapshots: SnapshotRecord[]) {
  const map = snapshotStore.get(orgNumber) ?? new Map();
  for (const snap of snapshots) {
    map.set(snap.unitKey, snap);
  }
  snapshotStore.set(orgNumber, map);
}

function rowToSnapshot(row: ParsedRow, reportDate: Date): SnapshotRecord {
  return {
    unitKey: buildUnitKey(row),
    reportDate,
    streetName: row.property.streetName,
    streetNumber: row.property.streetNumber,
    postalCode: row.property.postalCode,
    postalPlace: row.property.postalPlace,
    gnr: row.property.gnr,
    bnr: row.property.bnr,
    unitNumber: row.unit.unitNumber,
    customNumber: row.unit.customNumber,
    unitType: row.unit.unitType,
    numRooms: row.unit.numRooms,
    areaSqm: row.unit.areaSqm,
    numBedrooms: row.unit.numBedrooms,
    floor: row.unit.floor,
    externalContractId: row.contract.externalContractId,
    status: row.contract.status,
    contractType: row.contract.contractType,
    startDate: row.contract.startDate,
    endDate: row.contract.endDate,
    noticePeriodMonths: row.contract.noticePeriodMonths,
    earliestNoticeDate: row.contract.earliestNoticeDate,
    monthlyRent: row.contract.monthlyRent,
    fixedReduction: row.contract.fixedReduction,
    lastRentAdjDate: row.contract.lastRentAdjustmentDate,
    nextRentAdjDate: row.contract.nextRentAdjustmentDate,
    rentBeforeLastAdj: row.contract.rentBeforeLastAdjustment,
    cpiBase: row.contract.cpiBase,
    akontoElectricity: row.contract.akontoElectricity,
    akontoWaterSewage: row.contract.akontoWaterSewage,
    leaseholderName: row.tenant?.name ?? null,
    leaseholderEmail: row.tenant?.email ?? null,
    leaseholderPhone: row.tenant?.phone ?? null,
    securityType: row.security?.securityType ?? null,
    securityAmount: row.security?.amount ?? null,
  };
}

function snapshotToSnapshotData(snap: SnapshotRecord): SnapshotData {
  return {
    unitKey: snap.unitKey,
    status: snap.status,
    leaseholderName: snap.leaseholderName,
    leaseholderEmail: snap.leaseholderEmail,
    monthlyRent: snap.monthlyRent,
    fixedReduction: snap.fixedReduction,
    endDate: snap.endDate,
    startDate: snap.startDate,
    contractType: snap.contractType,
    externalContractId: snap.externalContractId,
    lastRentAdjDate: snap.lastRentAdjDate,
    securityType: snap.securityType,
    securityAmount: snap.securityAmount,
    akontoElectricity: snap.akontoElectricity,
    akontoWaterSewage: snap.akontoWaterSewage,
    customNumber: snap.customNumber,
  };
}

/**
 * Process a rent roll Excel file: parse, create snapshots, diff, generate events.
 */
export function processRentRoll(buffer: Buffer | ArrayBuffer): ImportResult {
  const parsed = parseRentRollExcel(buffer);

  const reportDate = parsed.reportDate
    ? parseNorwegianDate(parsed.reportDate) ?? new Date()
    : new Date();

  // Build snapshots from parsed rows
  const snapshots = parsed.rows.map((row) => rowToSnapshot(row, reportDate));

  // Get previous snapshots for this company
  const orgNumber = parsed.orgNumber ?? "unknown";
  const previousSnapshots = getLatestSnapshots(orgNumber);

  // Diff each snapshot against its previous version
  const allEvents: DetectedEvent[] = [];
  for (const snap of snapshots) {
    const prevSnap = previousSnapshots.get(snap.unitKey);
    const prevData = prevSnap ? snapshotToSnapshotData(prevSnap) : null;
    const currData = snapshotToSnapshotData(snap);
    const events = diffSnapshots(prevData, currData);
    allEvents.push(...events);
  }

  // Store new snapshots (overwriting previous for same unitKey)
  storeSnapshots(orgNumber, snapshots);

  const properties = [
    ...new Set(parsed.rows.map((r) => `${r.property.streetName} ${r.property.streetNumber}`)),
  ];

  return {
    orgName: parsed.orgName,
    orgNumber: parsed.orgNumber,
    reportDate: parsed.reportDate,
    totalRows: parsed.totalRows,
    parsedRows: parsed.rows.length,
    errorCount: parsed.errors.length,
    errors: parsed.errors,
    properties,
    snapshots,
    events: allEvents,
  };
}
