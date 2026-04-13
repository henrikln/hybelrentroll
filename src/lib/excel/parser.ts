import * as XLSX from "xlsx";
import {
  COLUMN_MAP,
  HEADER_ROW_INDEX,
  DATA_START_ROW,
  buildHeaderMap,
  parseOrgFromTitle,
} from "./column-map";
import { validateRow, type ParsedRow, type ParseError } from "./validators";

export interface ParseResult {
  orgName: string;
  orgNumber: string | null;
  reportDate: string | null;
  rows: ParsedRow[];
  errors: ParseError[];
  totalRows: number;
}

/**
 * Parse a rent roll Excel file buffer into structured data.
 */
export function parseRentRollExcel(buffer: Buffer | ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get all rows as arrays
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (rawData.length < DATA_START_ROW + 1) {
    return {
      orgName: "",
      orgNumber: null,
      reportDate: null,
      rows: [],
      errors: [{ row: 0, field: "file", message: "Filen inneholder ikke nok rader" }],
      totalRows: 0,
    };
  }

  // Parse organization info from title row (row 0)
  const titleCell = String(rawData[0]?.[0] ?? "");
  const { name: orgName, orgNumber } = parseOrgFromTitle(titleCell);

  // Extract report date from title: "..., DD.MM.YYYY"
  // Use the LAST date in the string — the first may be a birth date in the
  // landlord's name, e.g. "Erik Brustad (03.05.1982), 30.04.2026"
  const dateMatches = titleCell.match(/\d{2}\.\d{2}\.\d{4}/g);
  const reportDate = dateMatches ? dateMatches[dateMatches.length - 1] : null;

  // Build header map from row 4
  const headerRow = (rawData[HEADER_ROW_INDEX] ?? []).map((v) =>
    v !== null && v !== undefined ? String(v) : undefined
  );
  const headerMap = buildHeaderMap(headerRow);

  // Fields that are typically merged/grouped per property in Excel exports.
  // When these are empty on a row, we carry forward the previous row's values.
  const CARRY_FORWARD_FIELDS = new Set([
    "landlordName",
    "streetName",
    "streetNumber",
    "postalCode",
    "postalPlace",
    "municipality",
    "gnr",
    "bnr",
    "snr",
  ]);

  // Parse data rows
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  const dataRows = rawData.slice(DATA_START_ROW);
  const prevValues: Record<string, unknown> = {};

  for (let i = 0; i < dataRows.length; i++) {
    const excelRow = dataRows[i];
    if (!excelRow || excelRow.every((cell) => cell === null || cell === undefined || cell === "")) {
      continue; // Skip empty rows
    }

    // Map Excel columns to field names
    const raw: Record<string, unknown> = {};
    for (const mapping of COLUMN_MAP) {
      if (mapping.entity === "skip") continue;
      const colIndex = headerMap.get(mapping.excelHeader);
      if (colIndex !== undefined) {
        raw[mapping.field] = excelRow[colIndex];
      }
    }

    // Carry forward property-level fields from previous row when empty
    // (handles merged cells and grouped rows in Excel exports)
    for (const field of CARRY_FORWARD_FIELDS) {
      const val = raw[field];
      if (val === null || val === undefined || val === "") {
        if (prevValues[field] !== undefined) {
          raw[field] = prevValues[field];
        }
      } else {
        prevValues[field] = val;
      }
    }

    const rowIndex = DATA_START_ROW + i;
    const result = validateRow(raw, rowIndex);
    if (result.data) {
      rows.push(result.data);
    }
    errors.push(...result.errors);
  }

  return {
    orgName,
    orgNumber,
    reportDate,
    rows,
    errors,
    totalRows: dataRows.filter(
      (r) => r && !r.every((cell) => cell === null || cell === undefined || cell === "")
    ).length,
  };
}
