import { z } from "zod";

function toNullableString(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  const s = String(val).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function toNullableInt(val: unknown): number | null {
  const num = toNullableNumber(val);
  return num !== null ? Math.round(num) : null;
}

/**
 * Parse a date value from Excel.
 * Excel stores dates as serial numbers (days since 1900-01-01) or as strings "DD.MM.YYYY".
 */
function toNullableDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;

  // Excel serial number
  if (typeof val === "number") {
    // Excel epoch: Jan 1, 1900 (with the Lotus 1-2-3 bug for 1900-02-29)
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + val * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }

  // Already a Date
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // String: DD.MM.YYYY
  const s = String(val).trim();
  const parts = s.split(".");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    if (day && month && year) {
      return new Date(year, month - 1, day);
    }
  }

  // Try ISO format
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const unitTypeMap: Record<string, string> = {
  enebolig: "enebolig",
  leilighet: "leilighet",
  hybel: "hybel",
  næring: "naering",
  næringsbygg: "naering",
  annet: "annet",
};

const contractStatusMap: Record<string, string> = {
  aktiv: "aktiv",
  ledig: "ledig",
  oppsagt: "oppsagt",
};

const contractTypeMap: Record<string, string> = {
  tidsbestemt: "tidsbestemt",
  tidsubestemt: "tidsubestemt",
};

const securityTypeMap: Record<string, string> = {
  depositum: "depositum",
  "tryg forsikring": "forsikring",
  forsikring: "forsikring",
  garanti: "garanti",
  ingen: "ingen",
};

export interface ParsedRow {
  property: {
    streetName: string;
    streetNumber: string;
    postalCode: string;
    postalPlace: string;
    municipality: string | null;
    gnr: number | null;
    bnr: number | null;
    snr: number | null;
  };
  unit: {
    unitNumber: string | null;
    customNumber: string | null;
    unitType: string;
    numRooms: number | null;
    areaSqm: number | null;
    numBedrooms: number | null;
    floor: number | null;
  };
  tenant: {
    name: string | null;
    email: string | null;
    phone: string | null;
    invoiceEmail: string | null;
  } | null;
  contract: {
    externalContractId: string | null;
    status: string;
    contractType: string | null;
    startDate: Date | null;
    endDate: Date | null;
    terminationDate: Date | null;
    noticePeriodMonths: number | null;
    earliestNoticeDate: Date | null;
    monthlyRent: number | null;
    fixedReduction: number | null;
    lastRentAdjustmentDate: Date | null;
    nextRentAdjustmentDate: Date | null;
    rentBeforeLastAdjustment: number | null;
    cpiBase: number | null;
    akontoElectricity: number | null;
    akontoWaterSewage: number | null;
  };
  security: {
    securityType: string;
    amount: number | null;
  } | null;
}

export interface ParseError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export function validateRow(
  raw: Record<string, unknown>,
  rowIndex: number
): { data: ParsedRow | null; errors: ParseError[] } {
  const errors: ParseError[] = [];

  const streetName = toNullableString(raw.streetName);
  const streetNumber = toNullableString(raw.streetNumber);
  const postalCode = toNullableString(raw.postalCode);
  const postalPlace = toNullableString(raw.postalPlace);

  if (!streetName) {
    errors.push({ row: rowIndex, field: "Gatenavn", message: "Mangler gatenavn" });
    return { data: null, errors };
  }
  if (!streetNumber) {
    errors.push({ row: rowIndex, field: "Gatenummer", message: "Mangler gatenummer" });
    return { data: null, errors };
  }
  if (!postalCode) {
    errors.push({ row: rowIndex, field: "Postnummer", message: "Mangler postnummer" });
    return { data: null, errors };
  }
  if (!postalPlace) {
    errors.push({ row: rowIndex, field: "Poststed", message: "Mangler poststed" });
    return { data: null, errors };
  }

  const statusRaw = toNullableString(raw.status)?.toLowerCase() ?? "ledig";
  const status = contractStatusMap[statusRaw] ?? "ledig";

  const typeRaw = toNullableString(raw.contractType)?.toLowerCase();
  const contractType = typeRaw ? (contractTypeMap[typeRaw] ?? null) : null;

  const unitTypeRaw = toNullableString(raw.unitType)?.toLowerCase() ?? "annet";
  const unitType = unitTypeMap[unitTypeRaw] ?? "annet";

  const securityTypeRaw = toNullableString(raw.securityType)?.toLowerCase();
  const securityType = securityTypeRaw ? (securityTypeMap[securityTypeRaw] ?? null) : null;

  const tenantName = toNullableString(raw.name);

  const data: ParsedRow = {
    property: {
      streetName,
      streetNumber,
      postalCode,
      postalPlace,
      municipality: toNullableString(raw.municipality),
      gnr: toNullableInt(raw.gnr),
      bnr: toNullableInt(raw.bnr),
      snr: toNullableInt(raw.snr),
    },
    unit: {
      unitNumber: toNullableString(raw.unitNumber),
      customNumber: toNullableString(raw.customNumber),
      unitType,
      numRooms: toNullableInt(raw.numRooms),
      areaSqm: toNullableNumber(raw.areaSqm),
      numBedrooms: toNullableInt(raw.numBedrooms),
      floor: toNullableInt(raw.floor),
    },
    tenant: tenantName
      ? {
          name: tenantName,
          email: toNullableString(raw.email),
          phone: toNullableString(raw.phone),
          invoiceEmail: toNullableString(raw.invoiceEmail),
        }
      : null,
    contract: {
      externalContractId: toNullableString(raw.externalContractId),
      status,
      contractType,
      startDate: toNullableDate(raw.startDate),
      endDate: toNullableDate(raw.endDate),
      terminationDate: toNullableDate(raw.terminationDate),
      noticePeriodMonths: toNullableInt(raw.noticePeriodMonths),
      earliestNoticeDate: toNullableDate(raw.earliestNoticeDate),
      monthlyRent: toNullableNumber(raw.monthlyRent),
      fixedReduction: toNullableNumber(raw.fixedReduction),
      lastRentAdjustmentDate: toNullableDate(raw.lastRentAdjustmentDate),
      nextRentAdjustmentDate: toNullableDate(raw.nextRentAdjustmentDate),
      rentBeforeLastAdjustment: toNullableNumber(raw.rentBeforeLastAdjustment),
      cpiBase: toNullableNumber(raw.cpiBase),
      akontoElectricity: toNullableNumber(raw.akontoElectricity),
      akontoWaterSewage: toNullableNumber(raw.akontoWaterSewage),
    },
    security: securityType
      ? {
          securityType,
          amount: toNullableNumber(raw.securityAmount),
        }
      : null,
  };

  return { data, errors };
}
