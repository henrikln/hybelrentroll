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
  const dateMatch = titleCell.match(/(\d{2}\.\d{2}\.\d{4})/);
  const reportDate = dateMatch ? dateMatch[1] : null;

  // Build header map from row 4
  const headerRow = (rawData[HEADER_ROW_INDEX] ?? []).map((v) =>
    v !== null && v !== undefined ? String(v) : undefined
  );
  const headerMap = buildHeaderMap(headerRow);

  // Parse data rows
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  const dataRows = rawData.slice(DATA_START_ROW);

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
