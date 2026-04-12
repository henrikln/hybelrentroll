/**
 * Maps the 42 Norwegian column headers from the rent roll Excel export
 * to internal field names.
 *
 * Header row is at row index 4. Data starts at row index 5.
 * Row 0 contains: "NAGELGÅRDEN AS (931734385), 30.04.2026"
 */

export const HEADER_ROW_INDEX = 4;
export const DATA_START_ROW = 5;

export interface ColumnMapping {
  excelHeader: string;
  field: string;
  entity: "property" | "unit" | "tenant" | "contract" | "security" | "meta" | "skip";
}

export const COLUMN_MAP: ColumnMapping[] = [
  { excelHeader: "Utleier", field: "landlordName", entity: "meta" },
  { excelHeader: "Gatenavn", field: "streetName", entity: "property" },
  { excelHeader: "Gatenummer", field: "streetNumber", entity: "property" },
  { excelHeader: "Postnummer", field: "postalCode", entity: "property" },
  { excelHeader: "Poststed", field: "postalPlace", entity: "property" },
  { excelHeader: "Kommune", field: "municipality", entity: "property" },
  { excelHeader: "Gnr", field: "gnr", entity: "property" },
  { excelHeader: "Bnr", field: "bnr", entity: "property" },
  { excelHeader: "Snr", field: "snr", entity: "property" },
  { excelHeader: "Bolignummer", field: "unitNumber", entity: "unit" },
  { excelHeader: "Eget nummer", field: "customNumber", entity: "unit" },
  { excelHeader: "Rom/Enhet", field: "roomUnit", entity: "skip" },
  { excelHeader: "Type", field: "unitType", entity: "unit" },
  { excelHeader: "Antall rom", field: "numRooms", entity: "unit" },
  { excelHeader: "Areal", field: "areaSqm", entity: "unit" },
  { excelHeader: "Soverom", field: "numBedrooms", entity: "unit" },
  { excelHeader: "Etasje", field: "floor", entity: "unit" },
  { excelHeader: "Kategori", field: "category", entity: "skip" },
  { excelHeader: "Prosjekt", field: "project", entity: "skip" },
  { excelHeader: "Avdeling", field: "department", entity: "skip" },
  { excelHeader: "Kontrakt ID", field: "externalContractId", entity: "contract" },
  { excelHeader: "Kontrakt status", field: "status", entity: "contract" },
  { excelHeader: "Kontrakt type", field: "contractType", entity: "contract" },
  { excelHeader: "Leietaker", field: "name", entity: "tenant" },
  { excelHeader: "E-post", field: "email", entity: "tenant" },
  { excelHeader: "Telefon", field: "phone", entity: "tenant" },
  { excelHeader: "Faktura e-post", field: "invoiceEmail", entity: "tenant" },
  { excelHeader: "Leie", field: "monthlyRent", entity: "contract" },
  { excelHeader: "Fast reduksjon", field: "fixedReduction", entity: "contract" },
  { excelHeader: "Siste leieregulering", field: "lastRentAdjustmentDate", entity: "contract" },
  { excelHeader: "Neste indeksregulering", field: "nextRentAdjustmentDate", entity: "contract" },
  { excelHeader: "Leie før siste regulering", field: "rentBeforeLastAdjustment", entity: "contract" },
  { excelHeader: "KPI-grunnlag siste regulering", field: "cpiBase", entity: "contract" },
  { excelHeader: "Akonto strøm", field: "akontoElectricity", entity: "contract" },
  { excelHeader: "Akonto vann og avløp", field: "akontoWaterSewage", entity: "contract" },
  { excelHeader: "Sikkerhet", field: "securityType", entity: "security" },
  { excelHeader: "Sikkerhetsbeløp", field: "securityAmount", entity: "security" },
  { excelHeader: "Kontrakt start", field: "startDate", entity: "contract" },
  { excelHeader: "Kontrakt slutt", field: "endDate", entity: "contract" },
  { excelHeader: "Kontrakt avsluttes", field: "terminationDate", entity: "contract" },
  { excelHeader: "Oppsigelsestid", field: "noticePeriodMonths", entity: "contract" },
  { excelHeader: "Første mulige oppsigelsesdato", field: "earliestNoticeDate", entity: "contract" },
];

/**
 * Build a header-to-index map from the actual Excel headers.
 * Handles extra whitespace and case-insensitive matching.
 */
export function buildHeaderMap(headerRow: (string | undefined)[]): Map<string, number> {
  const map = new Map<string, number>();
  const normalizedExpected = COLUMN_MAP.map((c) => ({
    normalized: c.excelHeader.trim().toLowerCase(),
    original: c.excelHeader,
  }));

  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (!cell) continue;
    const normalized = String(cell).trim().toLowerCase();
    const match = normalizedExpected.find((e) => e.normalized === normalized);
    if (match) {
      map.set(match.original, i);
    }
  }

  return map;
}

/**
 * Parse the org name and org number from the title cell.
 * Example: "NAGELGÅRDEN AS (931734385), 30.04.2026"
 */
export function parseOrgFromTitle(title: string): { name: string; orgNumber: string | null } {
  const match = title.match(/^(.+?)\s*\((\d{9})\)/);
  if (match) {
    return { name: match[1].trim(), orgNumber: match[2] };
  }
  return { name: title.trim(), orgNumber: null };
}
