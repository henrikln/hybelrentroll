import { describe, it, expect } from "vitest";
import { buildHeaderMap, parseOrgFromTitle, COLUMN_MAP } from "../column-map";

describe("buildHeaderMap", () => {
  it("maps known headers to column indices", () => {
    const headers = ["Utleier", "Gatenavn", "Gatenummer", "Postnummer"];
    const map = buildHeaderMap(headers);
    expect(map.get("Utleier")).toBe(0);
    expect(map.get("Gatenavn")).toBe(1);
    expect(map.get("Gatenummer")).toBe(2);
    expect(map.get("Postnummer")).toBe(3);
  });

  it("handles case-insensitive matching", () => {
    const headers = ["GATENAVN", "gatenummer", "POSTNUMMER", "POSTSTED"];
    const map = buildHeaderMap(headers);
    expect(map.get("Gatenavn")).toBe(0);
    expect(map.get("Gatenummer")).toBe(1);
    expect(map.get("Postnummer")).toBe(2);
    expect(map.get("Poststed")).toBe(3);
  });

  it("handles extra whitespace in headers", () => {
    const headers = [" Gatenavn ", "  Gatenummer  "];
    const map = buildHeaderMap(headers);
    expect(map.get("Gatenavn")).toBe(0);
    expect(map.get("Gatenummer")).toBe(1);
  });

  it("skips undefined/null cells", () => {
    const headers = [undefined, "Gatenavn", undefined, "Gatenummer"];
    const map = buildHeaderMap(headers);
    expect(map.get("Gatenavn")).toBe(1);
    expect(map.get("Gatenummer")).toBe(3);
  });

  it("ignores unknown headers", () => {
    const headers = ["UnknownColumn", "Gatenavn", "AnotherRandom"];
    const map = buildHeaderMap(headers);
    expect(map.size).toBe(1);
    expect(map.get("Gatenavn")).toBe(1);
  });

  it("maps all 42 expected column headers", () => {
    const headers = COLUMN_MAP.map((c) => c.excelHeader);
    const map = buildHeaderMap(headers);
    expect(map.size).toBe(COLUMN_MAP.length);
  });
});

describe("parseOrgFromTitle", () => {
  it("parses org name and number from standard format", () => {
    const result = parseOrgFromTitle("NAGELGÅRDEN AS (931734385), 30.04.2026");
    expect(result.name).toBe("NAGELGÅRDEN AS");
    expect(result.orgNumber).toBe("931734385");
  });

  it("parses name with extra spaces before parenthesis", () => {
    const result = parseOrgFromTitle("BOLIGBYGG OS AS  (123456789), 01.01.2025");
    expect(result.name).toBe("BOLIGBYGG OS AS");
    expect(result.orgNumber).toBe("123456789");
  });

  it("returns null orgNumber when no parenthesized number", () => {
    const result = parseOrgFromTitle("NAGELGÅRDEN AS, 30.04.2026");
    expect(result.name).toBe("NAGELGÅRDEN AS, 30.04.2026");
    expect(result.orgNumber).toBeNull();
  });

  it("returns null orgNumber for non-9-digit number", () => {
    const result = parseOrgFromTitle("COMPANY (12345)");
    expect(result.orgNumber).toBeNull();
  });

  it("handles empty string", () => {
    const result = parseOrgFromTitle("");
    expect(result.name).toBe("");
    expect(result.orgNumber).toBeNull();
  });

  it("trims whitespace from name", () => {
    const result = parseOrgFromTitle("  COMPANY AS (987654321), date");
    expect(result.name).toBe("COMPANY AS");
  });
});
