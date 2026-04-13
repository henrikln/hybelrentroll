import { describe, it, expect } from "vitest";
import { buildUnitKey } from "../differ";
import type { ParsedRow } from "../validators";

/**
 * Test the deduplication logic from db-importer.ts in isolation.
 * The actual function is inlined in importRentRollToDb, so we replicate it here
 * to unit test it properly.
 */
function deduplicateRows(rows: ParsedRow[]): ParsedRow[] {
  const rowsByKey = new Map<string, ParsedRow>();
  for (const row of rows) {
    const key = buildUnitKey(row);
    const existing = rowsByKey.get(key);
    if (!existing) {
      rowsByKey.set(key, row);
      continue;
    }
    const existingStatus = existing.contract.status.toLowerCase();
    const newStatus = row.contract.status.toLowerCase();
    if (existingStatus === "aktiv" && newStatus !== "aktiv") continue;
    if (newStatus === "aktiv" && existingStatus !== "aktiv") {
      rowsByKey.set(key, row);
      continue;
    }
    const existingStart = existing.contract.startDate?.getTime() ?? 0;
    const newStart = row.contract.startDate?.getTime() ?? 0;
    if (newStart > existingStart) {
      rowsByKey.set(key, row);
    }
  }
  return [...rowsByKey.values()];
}

function makeRow(overrides: {
  streetName?: string;
  streetNumber?: string;
  unitNumber?: string | null;
  customNumber?: string | null;
  status?: string;
  startDate?: Date | null;
  leaseholderName?: string | null;
  monthlyRent?: number | null;
} = {}): ParsedRow {
  return {
    property: {
      streetName: overrides.streetName ?? "Storgata",
      streetNumber: overrides.streetNumber ?? "1",
      postalCode: "5000",
      postalPlace: "Bergen",
      municipality: null,
      gnr: null,
      bnr: null,
      snr: null,
    },
    unit: {
      unitNumber: overrides.unitNumber ?? "H0101",
      customNumber: overrides.customNumber ?? "BT1",
      unitType: "leilighet",
      numRooms: null,
      areaSqm: null,
      numBedrooms: null,
      floor: null,
    },
    tenant: overrides.leaseholderName
      ? { name: overrides.leaseholderName, email: null, phone: null, invoiceEmail: null }
      : null,
    contract: {
      externalContractId: null,
      status: overrides.status ?? "aktiv",
      contractType: null,
      startDate: overrides.startDate ?? null,
      endDate: null,
      terminationDate: null,
      noticePeriodMonths: null,
      earliestNoticeDate: null,
      monthlyRent: overrides.monthlyRent ?? 12000,
      fixedReduction: null,
      lastRentAdjustmentDate: null,
      nextRentAdjustmentDate: null,
      rentBeforeLastAdjustment: null,
      cpiBase: null,
      akontoElectricity: null,
      akontoWaterSewage: null,
    },
    security: null,
  };
}

describe("row deduplication", () => {
  it("keeps single row per unit", () => {
    const rows = [makeRow()];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
  });

  it("keeps different units separate", () => {
    const rows = [
      makeRow({ unitNumber: "H0101" }),
      makeRow({ unitNumber: "H0102" }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(2);
  });

  it("prefers aktiv row over ledig for same unit", () => {
    const rows = [
      makeRow({ status: "ledig", leaseholderName: null, monthlyRent: 0 }),
      makeRow({ status: "aktiv", leaseholderName: "Ola", monthlyRent: 12000 }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].contract.status).toBe("aktiv");
    expect(result[0].tenant!.name).toBe("Ola");
  });

  it("prefers aktiv even when ledig comes after aktiv", () => {
    const rows = [
      makeRow({ status: "aktiv", leaseholderName: "Ola", monthlyRent: 12000 }),
      makeRow({ status: "ledig", leaseholderName: null, monthlyRent: 0 }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].contract.status).toBe("aktiv");
  });

  it("prefers later startDate when both are aktiv", () => {
    const rows = [
      makeRow({ status: "aktiv", startDate: new Date(2023, 0, 1), monthlyRent: 10000 }),
      makeRow({ status: "aktiv", startDate: new Date(2024, 0, 1), monthlyRent: 12000 }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].contract.monthlyRent).toBe(12000);
  });

  it("prefers later startDate when both are ledig", () => {
    const rows = [
      makeRow({ status: "ledig", startDate: new Date(2023, 0, 1) }),
      makeRow({ status: "ledig", startDate: new Date(2024, 0, 1) }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].contract.startDate!.getFullYear()).toBe(2024);
  });

  it("keeps first row when both have same status and no startDate", () => {
    const rows = [
      makeRow({ status: "aktiv", startDate: null, monthlyRent: 10000 }),
      makeRow({ status: "aktiv", startDate: null, monthlyRent: 12000 }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].contract.monthlyRent).toBe(10000); // first wins
  });

  it("handles many duplicates for same unit", () => {
    const rows = [
      makeRow({ status: "ledig", startDate: new Date(2020, 0, 1) }),
      makeRow({ status: "aktiv", startDate: new Date(2022, 0, 1), monthlyRent: 10000 }),
      makeRow({ status: "ledig", startDate: new Date(2023, 0, 1) }),
      makeRow({ status: "aktiv", startDate: new Date(2024, 0, 1), monthlyRent: 14000 }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].contract.status).toBe("aktiv");
    expect(result[0].contract.monthlyRent).toBe(14000);
  });

  it("deduplicates across different properties correctly", () => {
    const rows = [
      // Property 1, Unit A: two rows
      makeRow({ streetName: "Gate1", streetNumber: "1", unitNumber: "A", status: "ledig" }),
      makeRow({ streetName: "Gate1", streetNumber: "1", unitNumber: "A", status: "aktiv", monthlyRent: 8000 }),
      // Property 2, Unit B: single row
      makeRow({ streetName: "Gate2", streetNumber: "2", unitNumber: "B", status: "aktiv", monthlyRent: 12000 }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(2);
    const unitA = result.find((r) => r.property.streetName === "Gate1");
    const unitB = result.find((r) => r.property.streetName === "Gate2");
    expect(unitA!.contract.status).toBe("aktiv");
    expect(unitB!.contract.monthlyRent).toBe(12000);
  });

  it("handles oppsagt vs aktiv (prefers aktiv)", () => {
    const rows = [
      makeRow({ status: "oppsagt", startDate: new Date(2024, 6, 1) }),
      makeRow({ status: "aktiv", startDate: new Date(2024, 0, 1) }),
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].contract.status).toBe("aktiv");
  });
});
