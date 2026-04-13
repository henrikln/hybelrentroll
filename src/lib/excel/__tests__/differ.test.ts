import { describe, it, expect } from "vitest";
import { diffSnapshots, buildUnitKey, type SnapshotData } from "../differ";

function makeSnapshot(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    unitKey: "storgata_1_h0101_bt1",
    status: "aktiv",
    leaseholderName: "Ola Nordmann",
    leaseholderEmail: "ola@test.no",
    monthlyRent: 12000,
    fixedReduction: 0,
    endDate: new Date(2025, 11, 31),
    startDate: new Date(2024, 0, 1),
    contractType: "tidsbestemt",
    externalContractId: "K-1234",
    lastRentAdjDate: null,
    securityType: "depositum",
    securityAmount: 36000,
    akontoElectricity: 500,
    akontoWaterSewage: 200,
    customNumber: "BT1",
    ...overrides,
  };
}

describe("buildUnitKey", () => {
  it("builds key from property and unit fields", () => {
    const key = buildUnitKey({
      property: { streetName: "Storgata", streetNumber: "1" },
      unit: { unitNumber: "H0101", customNumber: "BT1" },
    });
    expect(key).toBe("storgata_1_h0101_bt1");
  });

  it("lowercases the key", () => {
    const key = buildUnitKey({
      property: { streetName: "STORGATA", streetNumber: "1A" },
      unit: { unitNumber: "H0101", customNumber: null },
    });
    expect(key).toBe("storgata_1a_h0101_");
  });

  it("removes spaces from key", () => {
    const key = buildUnitKey({
      property: { streetName: "Store Gate", streetNumber: "1 B" },
      unit: { unitNumber: null, customNumber: null },
    });
    expect(key).toBe("storegate_1b__");
  });

  it("handles null unit fields", () => {
    const key = buildUnitKey({
      property: { streetName: "Gata", streetNumber: "5" },
      unit: { unitNumber: null, customNumber: null },
    });
    expect(key).toBe("gata_5__");
  });

  it("handles Norwegian characters", () => {
    const key = buildUnitKey({
      property: { streetName: "Øvre Korskirkeallmenningen", streetNumber: "3" },
      unit: { unitNumber: "H0201", customNumber: null },
    });
    expect(key).toBe("øvrekorskirkeallmenningen_3_h0201_");
  });
});

describe("diffSnapshots", () => {
  describe("new unit (no previous snapshot)", () => {
    it("creates unit_created event for occupied unit", () => {
      const events = diffSnapshots(null, makeSnapshot());
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("unit_created");
      expect(events[0].description).toContain("Ola Nordmann");
      expect(events[0].description).toContain("12000");
    });

    it("creates unit_created event for vacant unit", () => {
      const events = diffSnapshots(null, makeSnapshot({ leaseholderName: null, status: "ledig" }));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("unit_created");
      expect(events[0].description).toContain("ledig");
    });
  });

  describe("tenant changes", () => {
    it("detects tenant moved out", () => {
      const prev = makeSnapshot({ leaseholderName: "Ola Nordmann" });
      const curr = makeSnapshot({ leaseholderName: null });
      const events = diffSnapshots(prev, curr);
      const moveOut = events.find((e) => e.eventType === "tenant_moved_out");
      expect(moveOut).toBeDefined();
      expect(moveOut!.description).toContain("Ola Nordmann");
      expect(moveOut!.description).toContain("flyttet ut");
    });

    it("detects tenant moved in", () => {
      const prev = makeSnapshot({ leaseholderName: null });
      const curr = makeSnapshot({ leaseholderName: "Kari Hansen" });
      const events = diffSnapshots(prev, curr);
      const moveIn = events.find((e) => e.eventType === "tenant_moved_in");
      expect(moveIn).toBeDefined();
      expect(moveIn!.description).toContain("Kari Hansen");
      expect(moveIn!.description).toContain("flyttet inn");
    });

    it("detects tenant swap (moved out + moved in)", () => {
      const prev = makeSnapshot({ leaseholderName: "Ola Nordmann" });
      const curr = makeSnapshot({ leaseholderName: "Kari Hansen" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "tenant_moved_out")).toHaveLength(1);
      expect(events.filter((e) => e.eventType === "tenant_moved_in")).toHaveLength(1);
    });

    it("does not detect change when tenant is the same", () => {
      const prev = makeSnapshot({ leaseholderName: "Ola Nordmann" });
      const curr = makeSnapshot({ leaseholderName: "Ola Nordmann" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType.includes("tenant"))).toHaveLength(0);
    });

    it("trims whitespace when comparing tenant names", () => {
      const prev = makeSnapshot({ leaseholderName: "Ola Nordmann " });
      const curr = makeSnapshot({ leaseholderName: "Ola Nordmann" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType.includes("tenant"))).toHaveLength(0);
    });
  });

  describe("rent changes", () => {
    it("detects rent increase for same tenant", () => {
      const prev = makeSnapshot({ monthlyRent: 12000, leaseholderName: "Ola" });
      const curr = makeSnapshot({ monthlyRent: 13000, leaseholderName: "Ola" });
      const events = diffSnapshots(prev, curr);
      const rentChange = events.find((e) => e.eventType === "rent_changed");
      expect(rentChange).toBeDefined();
      expect(rentChange!.description).toContain("12000");
      expect(rentChange!.description).toContain("13000");
    });

    it("ignores small rent differences (< 0.01)", () => {
      const prev = makeSnapshot({ monthlyRent: 12000.001, leaseholderName: "Ola" });
      const curr = makeSnapshot({ monthlyRent: 12000.005, leaseholderName: "Ola" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "rent_changed")).toHaveLength(0);
    });

    it("does not report rent change when tenant changed", () => {
      const prev = makeSnapshot({ monthlyRent: 12000, leaseholderName: "Ola" });
      const curr = makeSnapshot({ monthlyRent: 15000, leaseholderName: "Kari" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "rent_changed")).toHaveLength(0);
    });

    it("does not report rent change for vacant unit", () => {
      const prev = makeSnapshot({ monthlyRent: 12000, leaseholderName: null });
      const curr = makeSnapshot({ monthlyRent: 13000, leaseholderName: null });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "rent_changed")).toHaveLength(0);
    });

    it("detects rent from null to value", () => {
      const prev = makeSnapshot({ monthlyRent: null, leaseholderName: "Ola" });
      const curr = makeSnapshot({ monthlyRent: 12000, leaseholderName: "Ola" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "rent_changed")).toHaveLength(1);
    });
  });

  describe("CPI adjustment", () => {
    it("detects CPI adjustment when lastRentAdjDate changes", () => {
      const prev = makeSnapshot({ lastRentAdjDate: new Date(2023, 0, 1) });
      const curr = makeSnapshot({ lastRentAdjDate: new Date(2024, 0, 1) });
      const events = diffSnapshots(prev, curr);
      const cpi = events.find((e) => e.eventType === "cpi_adjustment");
      expect(cpi).toBeDefined();
      expect(cpi!.description).toContain("KPI-regulering");
    });

    it("detects CPI adjustment from null to date", () => {
      const prev = makeSnapshot({ lastRentAdjDate: null });
      const curr = makeSnapshot({ lastRentAdjDate: new Date(2024, 0, 1) });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "cpi_adjustment")).toHaveLength(1);
    });

    it("does not detect CPI when date unchanged", () => {
      const d = new Date(2024, 0, 1);
      const prev = makeSnapshot({ lastRentAdjDate: d });
      const curr = makeSnapshot({ lastRentAdjDate: new Date(d.getTime()) });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "cpi_adjustment")).toHaveLength(0);
    });
  });

  describe("contract renewal", () => {
    it("detects contract renewal (end date extended)", () => {
      const prev = makeSnapshot({ endDate: new Date(2025, 11, 31) });
      const curr = makeSnapshot({ endDate: new Date(2026, 11, 31) });
      const events = diffSnapshots(prev, curr);
      const renewal = events.find((e) => e.eventType === "contract_renewed");
      expect(renewal).toBeDefined();
    });

    it("does not detect renewal when end date shortened", () => {
      const prev = makeSnapshot({ endDate: new Date(2026, 11, 31) });
      const curr = makeSnapshot({ endDate: new Date(2025, 11, 31) });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "contract_renewed")).toHaveLength(0);
    });

    it("detects renewal when prev has no end date (end date added)", () => {
      const prev = makeSnapshot({ endDate: null });
      const curr = makeSnapshot({ endDate: new Date(2026, 11, 31) });
      const events = diffSnapshots(prev, curr);
      const renewal = events.find((e) => e.eventType === "contract_renewed");
      expect(renewal).toBeDefined();
      expect(renewal!.description).toContain("Kontraktsluttdato satt til");
    });
  });

  describe("status changes", () => {
    it("detects status change aktiv -> ledig", () => {
      const prev = makeSnapshot({ status: "aktiv" });
      const curr = makeSnapshot({ status: "ledig" });
      const events = diffSnapshots(prev, curr);
      const statusChange = events.find((e) => e.eventType === "status_changed");
      expect(statusChange).toBeDefined();
      expect(statusChange!.description).toContain("aktiv");
      expect(statusChange!.description).toContain("ledig");
    });

    it("does not detect when status unchanged", () => {
      const prev = makeSnapshot({ status: "aktiv" });
      const curr = makeSnapshot({ status: "aktiv" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "status_changed")).toHaveLength(0);
    });
  });

  describe("security changes", () => {
    it("detects security type change", () => {
      const prev = makeSnapshot({ securityType: "depositum", securityAmount: 36000 });
      const curr = makeSnapshot({ securityType: "forsikring", securityAmount: 36000 });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "security_changed")).toHaveLength(1);
    });

    it("detects security amount change", () => {
      const prev = makeSnapshot({ securityType: "depositum", securityAmount: 36000 });
      const curr = makeSnapshot({ securityType: "depositum", securityAmount: 48000 });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "security_changed")).toHaveLength(1);
    });

    it("does not detect when security unchanged", () => {
      const prev = makeSnapshot({ securityType: "depositum", securityAmount: 36000 });
      const curr = makeSnapshot({ securityType: "depositum", securityAmount: 36000 });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "security_changed")).toHaveLength(0);
    });
  });

  describe("no changes", () => {
    it("returns empty array when nothing changed", () => {
      const snap = makeSnapshot();
      const events = diffSnapshots(snap, { ...snap });
      expect(events).toHaveLength(0);
    });
  });

  describe("multiple simultaneous changes", () => {
    it("detects tenant swap + status change", () => {
      const prev = makeSnapshot({ leaseholderName: "Ola", status: "aktiv" });
      const curr = makeSnapshot({ leaseholderName: null, status: "ledig" });
      const events = diffSnapshots(prev, curr);
      expect(events.filter((e) => e.eventType === "tenant_moved_out")).toHaveLength(1);
      expect(events.filter((e) => e.eventType === "status_changed")).toHaveLength(1);
    });
  });
});
