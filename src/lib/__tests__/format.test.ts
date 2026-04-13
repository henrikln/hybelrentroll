import { describe, it, expect } from "vitest";
import {
  formatNOK,
  formatNOKShort,
  formatArea,
  formatDecimal,
  formatDate,
  parseNorwegianDate,
  parseNorwegianNumber,
} from "../format";

describe("formatNOK", () => {
  it("formats with Norwegian thousands separator", () => {
    const result = formatNOK(1234567);
    // Norwegian locale uses non-breaking space as thousands separator
    expect(result.replace(/\s/g, " ")).toBe("1 234 567");
  });

  it("formats zero", () => {
    expect(formatNOK(0)).toBe("0");
  });

  it("rounds decimals", () => {
    const result = formatNOK(1234.56);
    expect(result.replace(/\s/g, " ")).toBe("1 235");
  });
});

describe("formatNOKShort", () => {
  it("formats millions with 'mill.'", () => {
    const result = formatNOKShort(2500000);
    expect(result).toBe("2,50 mill.");
  });

  it("formats thousands with 'k'", () => {
    expect(formatNOKShort(12500)).toBe("13k");
  });

  it("formats small numbers normally", () => {
    const result = formatNOKShort(500);
    expect(result.replace(/\s/g, " ")).toBe("500");
  });

  it("formats exactly 1 million", () => {
    expect(formatNOKShort(1000000)).toBe("1,00 mill.");
  });

  it("formats exactly 1000 as k", () => {
    expect(formatNOKShort(1000)).toBe("1k");
  });
});

describe("formatArea", () => {
  it("formats area with m² suffix", () => {
    const result = formatArea(55);
    expect(result).toContain("55");
    expect(result).toContain("m²");
  });

  it("formats large areas with thousands separator", () => {
    const result = formatArea(1500);
    expect(result).toContain("m²");
  });
});

describe("formatDecimal", () => {
  it("formats with Norwegian decimal comma", () => {
    expect(formatDecimal(3.5)).toBe("3,5");
  });

  it("formats with custom decimal places", () => {
    expect(formatDecimal(3.14159, 2)).toBe("3,14");
  });

  it("defaults to 1 decimal place", () => {
    expect(formatDecimal(10.0)).toBe("10,0");
  });
});

describe("formatDate", () => {
  it("formats Date object to Norwegian format", () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toBe("15.01.2024");
  });

  it("formats ISO string", () => {
    const result = formatDate("2024-06-01T00:00:00.000Z");
    expect(result).toMatch(/01\.06\.2024/);
  });

  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("parseNorwegianDate", () => {
  it("parses DD.MM.YYYY format", () => {
    const date = parseNorwegianDate("15.06.2024");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2024);
    expect(date!.getMonth()).toBe(5); // 0-indexed
    expect(date!.getDate()).toBe(15);
  });

  it("parses 01.01.2000", () => {
    const date = parseNorwegianDate("01.01.2000");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2000);
  });

  it("returns null for empty string", () => {
    expect(parseNorwegianDate("")).toBeNull();
  });

  it("returns null for invalid format", () => {
    expect(parseNorwegianDate("2024-01-15")).toBeNull();
  });

  it("returns null for two-part string", () => {
    expect(parseNorwegianDate("01.2024")).toBeNull();
  });
});

describe("parseNorwegianNumber", () => {
  it("parses number input directly", () => {
    expect(parseNorwegianNumber(1234)).toBe(1234);
  });

  it("parses string with comma decimal", () => {
    expect(parseNorwegianNumber("1234,56")).toBe(1234.56);
  });

  it("strips whitespace (thousands separator)", () => {
    expect(parseNorwegianNumber("1 234 567")).toBe(1234567);
  });

  it("handles combined whitespace and comma", () => {
    expect(parseNorwegianNumber("12 500,50")).toBe(12500.5);
  });

  it("returns null for empty string", () => {
    expect(parseNorwegianNumber("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseNorwegianNumber("N/A")).toBeNull();
  });

  it("returns 0 for zero", () => {
    expect(parseNorwegianNumber(0)).toBe(0);
  });
});
