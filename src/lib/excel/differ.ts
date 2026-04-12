/**
 * Diffs consecutive rent roll snapshots to detect events.
 * Compares a new snapshot against the most recent previous snapshot
 * for the same unit (by unitKey).
 */

export interface SnapshotData {
  unitKey: string;
  status: string;
  leaseholderName: string | null;
  leaseholderEmail: string | null;
  monthlyRent: number | null;
  fixedReduction: number | null;
  endDate: Date | null;
  startDate: Date | null;
  contractType: string | null;
  externalContractId: string | null;
  lastRentAdjDate: Date | null;
  securityType: string | null;
  securityAmount: number | null;
  akontoElectricity: number | null;
  akontoWaterSewage: number | null;
  customNumber: string | null;
}

export interface DetectedEvent {
  unitKey: string;
  eventType: string;
  description: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

function unitLabel(snap: SnapshotData): string {
  return snap.customNumber ?? snap.unitKey.split("_").slice(-1)[0] ?? snap.unitKey;
}

function decimalEqual(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.01;
}

function dateEqual(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

/**
 * Diff a new snapshot against a previous one for the same unit.
 * Returns an array of detected events.
 */
export function diffSnapshots(
  prev: SnapshotData | null,
  curr: SnapshotData
): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const label = unitLabel(curr);

  // New unit (no previous snapshot)
  if (!prev) {
    if (curr.leaseholderName) {
      events.push({
        unitKey: curr.unitKey,
        eventType: "unit_created",
        description: `${label}: Ny enhet registrert — ${curr.leaseholderName} (kr ${curr.monthlyRent ?? 0}/mnd)`,
        oldValue: null,
        newValue: {
          status: curr.status,
          leaseholder: curr.leaseholderName,
          monthlyRent: curr.monthlyRent,
        },
      });
    } else {
      events.push({
        unitKey: curr.unitKey,
        eventType: "unit_created",
        description: `${label}: Ny enhet registrert (ledig)`,
        oldValue: null,
        newValue: { status: curr.status },
      });
    }
    return events;
  }

  // Tenant change
  const prevTenant = prev.leaseholderName?.trim() ?? null;
  const currTenant = curr.leaseholderName?.trim() ?? null;

  if (prevTenant !== currTenant) {
    if (prevTenant && !currTenant) {
      events.push({
        unitKey: curr.unitKey,
        eventType: "tenant_moved_out",
        description: `${label}: ${prevTenant} har flyttet ut`,
        oldValue: { leaseholder: prevTenant },
        newValue: null,
      });
    } else if (!prevTenant && currTenant) {
      events.push({
        unitKey: curr.unitKey,
        eventType: "tenant_moved_in",
        description: `${label}: ${currTenant} har flyttet inn`,
        oldValue: null,
        newValue: { leaseholder: currTenant, monthlyRent: curr.monthlyRent },
      });
    } else if (prevTenant && currTenant) {
      events.push({
        unitKey: curr.unitKey,
        eventType: "tenant_moved_out",
        description: `${label}: ${prevTenant} har flyttet ut`,
        oldValue: { leaseholder: prevTenant },
        newValue: null,
      });
      events.push({
        unitKey: curr.unitKey,
        eventType: "tenant_moved_in",
        description: `${label}: ${currTenant} har flyttet inn`,
        oldValue: null,
        newValue: { leaseholder: currTenant, monthlyRent: curr.monthlyRent },
      });
    }
  }

  // Rent change (only if same tenant or both occupied)
  if (!decimalEqual(prev.monthlyRent, curr.monthlyRent) && prevTenant === currTenant && currTenant) {
    events.push({
      unitKey: curr.unitKey,
      eventType: "rent_changed",
      description: `${label}: Leie endret fra kr ${prev.monthlyRent ?? 0} til kr ${curr.monthlyRent ?? 0}`,
      oldValue: { monthlyRent: prev.monthlyRent },
      newValue: { monthlyRent: curr.monthlyRent },
    });
  }

  // CPI adjustment detected
  if (!dateEqual(prev.lastRentAdjDate, curr.lastRentAdjDate) && curr.lastRentAdjDate) {
    events.push({
      unitKey: curr.unitKey,
      eventType: "cpi_adjustment",
      description: `${label}: KPI-regulering utført`,
      oldValue: { lastRentAdjDate: prev.lastRentAdjDate, monthlyRent: prev.monthlyRent },
      newValue: { lastRentAdjDate: curr.lastRentAdjDate, monthlyRent: curr.monthlyRent },
    });
  }

  // Contract renewed (end_date extended)
  if (!dateEqual(prev.endDate, curr.endDate) && curr.endDate && prev.endDate && curr.endDate > prev.endDate) {
    events.push({
      unitKey: curr.unitKey,
      eventType: "contract_renewed",
      description: `${label}: Kontrakt forlenget til ${curr.endDate.toLocaleDateString("nb-NO")}`,
      oldValue: { endDate: prev.endDate },
      newValue: { endDate: curr.endDate },
    });
  }

  // Status change
  if (prev.status !== curr.status) {
    events.push({
      unitKey: curr.unitKey,
      eventType: "status_changed",
      description: `${label}: Status endret fra ${prev.status} til ${curr.status}`,
      oldValue: { status: prev.status },
      newValue: { status: curr.status },
    });
  }

  // Security changed
  if (prev.securityType !== curr.securityType || !decimalEqual(prev.securityAmount, curr.securityAmount)) {
    events.push({
      unitKey: curr.unitKey,
      eventType: "security_changed",
      description: `${label}: Sikkerhet endret`,
      oldValue: { securityType: prev.securityType, securityAmount: prev.securityAmount },
      newValue: { securityType: curr.securityType, securityAmount: curr.securityAmount },
    });
  }

  return events;
}

/**
 * Build a unit key from parsed row data.
 * Format: streetName_streetNumber_unitNumber_customNumber
 */
export function buildUnitKey(row: {
  property: { streetName: string; streetNumber: string };
  unit: { unitNumber: string | null; customNumber: string | null };
}): string {
  const parts = [
    row.property.streetName,
    row.property.streetNumber,
    row.unit.unitNumber ?? "",
    row.unit.customNumber ?? "",
  ];
  return parts.join("_").toLowerCase().replace(/\s+/g, "");
}
