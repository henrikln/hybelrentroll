import { describe, it, expect } from "vitest";
import { validateRow, type ParsedRow } from "../validators";

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    streetName: "Storgata",
    streetNumber: "1",
    postalCode: "5003",
    postalPlace: "Bergen",
    municipality: "Bergen",
    gnr: 10,
    bnr: 20,
    snr: null,
    unitNumber: "H0101",
    customNumber: "BT1",
    unitType: "Leilighet",
    numRooms: 3,
    areaSqm: 55.5,
    numBedrooms: 2,
    floor: 1,
    externalContractId: "K-1234",
    status: "Aktiv",
    contractType: "Tidsbestemt",
    name: "Ola Nordmann",
    email: "ola@test.no",
    phone: "12345678",
    invoiceEmail: null,
    monthlyRent: 12000,
    fixedReduction: 0,
    startDate: "01.01.2024",
    endDate: "31.12.2025",
    terminationDate: null,
    noticePeriodMonths: 3,
    earliestNoticeDate: null,
    lastRentAdjustmentDate: null,
    nextRentAdjustmentDate: null,
    rentBeforeLastAdjustment: null,
    cpiBase: null,
    akontoElectricity: 500,
    akontoWaterSewage: 200,
    securityType: "Depositum",
    securityAmount: 36000,
    ...overrides,
  };
}

describe("validateRow", () => {
  describe("required fields", () => {
    it("returns parsed data for valid row", () => {
      const { data, errors } = validateRow(makeRaw(), 5);
      expect(data).not.toBeNull();
      expect(errors).toHaveLength(0);
      expect(data!.property.streetName).toBe("Storgata");
      expect(data!.property.streetNumber).toBe("1");
    });

    it("rejects row missing streetName", () => {
      const { data, errors } = validateRow(makeRaw({ streetName: null }), 5);
      expect(data).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe("Gatenavn");
    });

    it("rejects row missing streetNumber", () => {
      const { data, errors } = validateRow(makeRaw({ streetNumber: "" }), 5);
      expect(data).toBeNull();
      expect(errors[0].field).toBe("Gatenummer");
    });

    it("rejects row missing postalCode", () => {
      const { data, errors } = validateRow(makeRaw({ postalCode: null }), 5);
      expect(data).toBeNull();
      expect(errors[0].field).toBe("Postnummer");
    });

    it("rejects row missing postalPlace", () => {
      const { data, errors } = validateRow(makeRaw({ postalPlace: undefined }), 5);
      expect(data).toBeNull();
      expect(errors[0].field).toBe("Poststed");
    });

    it("trims whitespace from required fields", () => {
      const { data } = validateRow(makeRaw({ streetName: "  Storgata  " }), 5);
      expect(data!.property.streetName).toBe("Storgata");
    });
  });

  describe("status mapping", () => {
    it("maps 'Aktiv' to 'aktiv'", () => {
      const { data } = validateRow(makeRaw({ status: "Aktiv" }), 5);
      expect(data!.contract.status).toBe("aktiv");
    });

    it("maps 'ledig' (lowercase) to 'ledig'", () => {
      const { data } = validateRow(makeRaw({ status: "ledig" }), 5);
      expect(data!.contract.status).toBe("ledig");
    });

    it("maps 'Oppsagt' to 'oppsagt'", () => {
      const { data } = validateRow(makeRaw({ status: "Oppsagt" }), 5);
      expect(data!.contract.status).toBe("oppsagt");
    });

    it("defaults unknown status to 'ledig'", () => {
      const { data } = validateRow(makeRaw({ status: "INVALID" }), 5);
      expect(data!.contract.status).toBe("ledig");
    });

    it("defaults missing status to 'ledig'", () => {
      const { data } = validateRow(makeRaw({ status: null }), 5);
      expect(data!.contract.status).toBe("ledig");
    });
  });

  describe("unit type mapping", () => {
    it("maps 'Leilighet' to 'leilighet'", () => {
      const { data } = validateRow(makeRaw({ unitType: "Leilighet" }), 5);
      expect(data!.unit.unitType).toBe("leilighet");
    });

    it("maps 'Næring' to 'naering'", () => {
      const { data } = validateRow(makeRaw({ unitType: "Næring" }), 5);
      expect(data!.unit.unitType).toBe("naering");
    });

    it("defaults unknown type to 'annet'", () => {
      const { data } = validateRow(makeRaw({ unitType: "garasje" }), 5);
      expect(data!.unit.unitType).toBe("annet");
    });

    it("defaults missing type to 'annet'", () => {
      const { data } = validateRow(makeRaw({ unitType: null }), 5);
      expect(data!.unit.unitType).toBe("annet");
    });
  });

  describe("contract type mapping", () => {
    it("maps 'Tidsbestemt' to 'tidsbestemt'", () => {
      const { data } = validateRow(makeRaw({ contractType: "Tidsbestemt" }), 5);
      expect(data!.contract.contractType).toBe("tidsbestemt");
    });

    it("returns null for unknown contract type", () => {
      const { data } = validateRow(makeRaw({ contractType: "monthly" }), 5);
      expect(data!.contract.contractType).toBeNull();
    });
  });

  describe("security type mapping", () => {
    it("maps 'Depositum' to 'depositum'", () => {
      const { data } = validateRow(makeRaw({ securityType: "Depositum" }), 5);
      expect(data!.security).not.toBeNull();
      expect(data!.security!.securityType).toBe("depositum");
    });

    it("maps 'Tryg forsikring' to 'forsikring'", () => {
      const { data } = validateRow(makeRaw({ securityType: "Tryg forsikring" }), 5);
      expect(data!.security!.securityType).toBe("forsikring");
    });

    it("returns null security for unknown type", () => {
      const { data } = validateRow(makeRaw({ securityType: "unknown" }), 5);
      expect(data!.security).toBeNull();
    });

    it("returns null security when type is missing", () => {
      const { data } = validateRow(makeRaw({ securityType: null }), 5);
      expect(data!.security).toBeNull();
    });
  });

  describe("tenant handling", () => {
    it("creates tenant object when name is present", () => {
      const { data } = validateRow(makeRaw({ name: "Ola Nordmann", email: "ola@test.no" }), 5);
      expect(data!.tenant).not.toBeNull();
      expect(data!.tenant!.name).toBe("Ola Nordmann");
      expect(data!.tenant!.email).toBe("ola@test.no");
    });

    it("returns null tenant when name is missing", () => {
      const { data } = validateRow(makeRaw({ name: null, email: "ola@test.no" }), 5);
      expect(data!.tenant).toBeNull();
    });

    it("returns null tenant when name is empty string", () => {
      const { data } = validateRow(makeRaw({ name: "", email: "ola@test.no" }), 5);
      expect(data!.tenant).toBeNull();
    });
  });

  describe("number parsing", () => {
    it("parses Norwegian decimal format (comma)", () => {
      const { data } = validateRow(makeRaw({ monthlyRent: "12 500,50" }), 5);
      expect(data!.contract.monthlyRent).toBe(12500.5);
    });

    it("parses plain numbers", () => {
      const { data } = validateRow(makeRaw({ monthlyRent: 15000 }), 5);
      expect(data!.contract.monthlyRent).toBe(15000);
    });

    it("returns null for non-numeric strings", () => {
      const { data } = validateRow(makeRaw({ monthlyRent: "N/A" }), 5);
      expect(data!.contract.monthlyRent).toBeNull();
    });

    it("returns null for empty value", () => {
      const { data } = validateRow(makeRaw({ monthlyRent: "" }), 5);
      expect(data!.contract.monthlyRent).toBeNull();
    });

    it("rounds integers for int fields", () => {
      const { data } = validateRow(makeRaw({ numRooms: 3.7 }), 5);
      expect(data!.unit.numRooms).toBe(4);
    });

    it("preserves decimals for decimal fields", () => {
      const { data } = validateRow(makeRaw({ areaSqm: 55.5 }), 5);
      expect(data!.unit.areaSqm).toBe(55.5);
    });
  });

  describe("date parsing", () => {
    it("parses DD.MM.YYYY format", () => {
      const { data } = validateRow(makeRaw({ startDate: "01.06.2024" }), 5);
      expect(data!.contract.startDate).toBeInstanceOf(Date);
      expect(data!.contract.startDate!.getFullYear()).toBe(2024);
      expect(data!.contract.startDate!.getMonth()).toBe(5); // 0-indexed
      expect(data!.contract.startDate!.getDate()).toBe(1);
    });

    it("parses Excel serial number", () => {
      // Excel serial 45292 = 2024-01-01
      const { data } = validateRow(makeRaw({ startDate: 45292 }), 5);
      expect(data!.contract.startDate).toBeInstanceOf(Date);
      expect(data!.contract.startDate!.getFullYear()).toBe(2024);
    });

    it("returns null for empty date", () => {
      const { data } = validateRow(makeRaw({ startDate: null }), 5);
      expect(data!.contract.startDate).toBeNull();
    });

    it("passes through Date objects", () => {
      const d = new Date(2024, 5, 15);
      const { data } = validateRow(makeRaw({ startDate: d }), 5);
      expect(data!.contract.startDate!.getTime()).toBe(d.getTime());
    });
  });

  describe("complete row output", () => {
    it("maps all property fields correctly", () => {
      const { data } = validateRow(makeRaw({ gnr: 100, bnr: 200, snr: 5 }), 5);
      expect(data!.property.gnr).toBe(100);
      expect(data!.property.bnr).toBe(200);
      expect(data!.property.snr).toBe(5);
      expect(data!.property.municipality).toBe("Bergen");
    });

    it("maps security amount correctly", () => {
      const { data } = validateRow(makeRaw({ securityType: "Depositum", securityAmount: 36000 }), 5);
      expect(data!.security!.amount).toBe(36000);
    });

    it("maps contract dates correctly", () => {
      const { data } = validateRow(makeRaw({
        startDate: "01.01.2024",
        endDate: "31.12.2025",
        noticePeriodMonths: 3,
      }), 5);
      expect(data!.contract.noticePeriodMonths).toBe(3);
      expect(data!.contract.endDate).toBeInstanceOf(Date);
    });
  });
});
