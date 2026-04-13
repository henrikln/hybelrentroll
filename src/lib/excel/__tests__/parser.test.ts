import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseRentRollExcel } from "../parser";
import { COLUMN_MAP, HEADER_ROW_INDEX, DATA_START_ROW } from "../column-map";

/**
 * Helper to build a minimal valid Excel buffer for testing.
 * Creates a workbook with the right structure:
 * - Row 0: title with org info and date
 * - Rows 1-3: empty (padding)
 * - Row 4: headers
 * - Row 5+: data rows
 */
function buildExcelBuffer(opts: {
  title?: string;
  headers?: string[];
  dataRows?: unknown[][];
}): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: unknown[][] = [];

  // Row 0: title
  rows.push([opts.title ?? "TESTSELSKAP AS (123456789), 15.03.2026"]);

  // Rows 1-3: padding
  rows.push([]);
  rows.push([]);
  rows.push([]);

  // Row 4: headers
  const headers = opts.headers ?? COLUMN_MAP.map((c) => c.excelHeader);
  rows.push(headers);

  // Row 5+: data
  if (opts.dataRows) {
    for (const dr of opts.dataRows) {
      rows.push(dr);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/**
 * Build a data row array matching COLUMN_MAP order.
 */
function buildDataRow(overrides: Record<string, unknown> = {}): unknown[] {
  const defaults: Record<string, unknown> = {
    Utleier: "TESTSELSKAP AS",
    Gatenavn: "Testgata",
    Gatenummer: "1",
    Postnummer: "5000",
    Poststed: "Bergen",
    Kommune: "Bergen",
    Gnr: 100,
    Bnr: 200,
    Snr: null,
    Bolignummer: "H0101",
    "Eget nummer": "T1",
    "Rom/Enhet": "2-roms",
    Type: "Leilighet",
    "Antall rom": 3,
    Areal: 55,
    Soverom: 2,
    Etasje: 1,
    Kategori: null,
    Prosjekt: null,
    Avdeling: null,
    "Kontrakt ID": "K-001",
    "Kontrakt status": "Aktiv",
    "Kontrakt type": "Tidsbestemt",
    Leietaker: "Test Person",
    "E-post": "test@test.no",
    Telefon: "99887766",
    "Faktura e-post": null,
    Leie: 12000,
    "Fast reduksjon": 0,
    "Siste leieregulering": null,
    "Neste indeksregulering": null,
    "Leie før siste regulering": null,
    "KPI-grunnlag siste regulering": null,
    "Akonto strøm": 500,
    "Akonto vann og avløp": 200,
    Sikkerhet: "Depositum",
    Sikkerhetsbeløp: 36000,
    "Kontrakt start": "01.01.2024",
    "Kontrakt slutt": "31.12.2025",
    "Kontrakt avsluttes": null,
    Oppsigelsestid: 3,
    "Første mulige oppsigelsesdato": null,
    ...overrides,
  };

  const headers = COLUMN_MAP.map((c) => c.excelHeader);
  return headers.map((h) => defaults[h] ?? null);
}

describe("parseRentRollExcel", () => {
  it("parses org name and number from title row", () => {
    const buffer = buildExcelBuffer({
      title: "NAGELGÅRDEN AS (931734385), 30.04.2026",
      dataRows: [buildDataRow()],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.orgName).toBe("NAGELGÅRDEN AS");
    expect(result.orgNumber).toBe("931734385");
  });

  it("parses report date from title row", () => {
    const buffer = buildExcelBuffer({
      title: "COMPANY AS (111222333), 15.03.2026",
      dataRows: [buildDataRow()],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.reportDate).toBe("15.03.2026");
  });

  it("returns null reportDate when no date in title", () => {
    const buffer = buildExcelBuffer({
      title: "COMPANY AS (111222333)",
      dataRows: [buildDataRow()],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.reportDate).toBeNull();
  });

  it("parses valid data rows", () => {
    const buffer = buildExcelBuffer({ dataRows: [buildDataRow()] });
    const result = parseRentRollExcel(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].property.streetName).toBe("Testgata");
    expect(result.rows[0].contract.monthlyRent).toBe(12000);
    expect(result.rows[0].tenant!.name).toBe("Test Person");
  });

  it("parses multiple data rows", () => {
    const buffer = buildExcelBuffer({
      dataRows: [
        buildDataRow({ Gatenavn: "Gate A", Gatenummer: "1" }),
        buildDataRow({ Gatenavn: "Gate B", Gatenummer: "2" }),
        buildDataRow({ Gatenavn: "Gate C", Gatenummer: "3" }),
      ],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.rows).toHaveLength(3);
    expect(result.totalRows).toBe(3);
  });

  it("skips empty rows", () => {
    const buffer = buildExcelBuffer({
      dataRows: [
        buildDataRow(),
        Array(42).fill(null), // empty row
        buildDataRow({ Gatenavn: "Second" }),
      ],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.rows).toHaveLength(2);
  });

  it("reports errors for rows with missing required fields", () => {
    const buffer = buildExcelBuffer({
      dataRows: [
        buildDataRow({ Gatenavn: null }), // missing required field
      ],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe("Gatenavn");
  });

  it("returns error for file with too few rows", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Only one row"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    const result = parseRentRollExcel(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("ikke nok rader");
  });

  it("handles vacant unit (no tenant)", () => {
    const buffer = buildExcelBuffer({
      dataRows: [
        buildDataRow({
          Leietaker: null,
          "E-post": null,
          Telefon: null,
          "Kontrakt status": "Ledig",
        }),
      ],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tenant).toBeNull();
    expect(result.rows[0].contract.status).toBe("ledig");
  });

  it("handles row with all optional fields null", () => {
    const buffer = buildExcelBuffer({
      dataRows: [
        buildDataRow({
          Kommune: null,
          Gnr: null,
          Bnr: null,
          Snr: null,
          Bolignummer: null,
          "Eget nummer": null,
          "Kontrakt ID": null,
          Leietaker: null,
          "E-post": null,
          Telefon: null,
          Leie: null,
          Sikkerhet: null,
          Sikkerhetsbeløp: null,
          "Kontrakt start": null,
          "Kontrakt slutt": null,
        }),
      ],
    });
    const result = parseRentRollExcel(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].property.gnr).toBeNull();
    expect(result.rows[0].tenant).toBeNull();
    expect(result.rows[0].security).toBeNull();
    expect(result.rows[0].contract.monthlyRent).toBeNull();
  });
});
