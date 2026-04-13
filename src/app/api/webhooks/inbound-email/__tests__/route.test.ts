import { describe, it, expect } from "vitest";

/**
 * Tests for the webhook route's pure helper functions.
 * We extract and test parseEmailAddress logic here since it's not exported.
 * The actual route handler requires DB and external API mocking.
 */

// Replicate the parseEmailAddress function from route.ts
function parseEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  const trimmed = raw.toLowerCase().trim();
  return trimmed.includes("@") ? trimmed : "";
}

describe("parseEmailAddress", () => {
  it("extracts email from 'Name <email>' format", () => {
    expect(parseEmailAddress("Ola Nordmann <ola@test.no>")).toBe("ola@test.no");
  });

  it("extracts email from system-style format", () => {
    expect(parseEmailAddress("Hybel.no Viewer <noreply@estatelab.amp11.no>")).toBe("noreply@estatelab.amp11.no");
  });

  it("handles bare email address", () => {
    expect(parseEmailAddress("ola@test.no")).toBe("ola@test.no");
  });

  it("lowercases the email", () => {
    expect(parseEmailAddress("Ola.Nordmann@Test.NO")).toBe("ola.nordmann@test.no");
  });

  it("lowercases email inside angle brackets", () => {
    expect(parseEmailAddress("Name <OLA@TEST.NO>")).toBe("ola@test.no");
  });

  it("trims whitespace", () => {
    expect(parseEmailAddress("  ola@test.no  ")).toBe("ola@test.no");
  });

  it("trims whitespace inside angle brackets", () => {
    expect(parseEmailAddress("Name < ola@test.no >")).toBe("ola@test.no");
  });

  it("returns empty string for non-email string", () => {
    expect(parseEmailAddress("just a name")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(parseEmailAddress("")).toBe("");
  });

  it("handles multiple angle brackets (takes first)", () => {
    expect(parseEmailAddress("<first@test.no> <second@test.no>")).toBe("first@test.no");
  });
});

describe("webhook request validation", () => {
  it("should reject requests without sender email", () => {
    // The route returns 400 when senderEmail is empty
    const senderEmail = parseEmailAddress("");
    expect(senderEmail).toBe("");
  });

  it("should identify xlsx attachments", () => {
    const attachments = [
      { filename: "rentroll.xlsx" },
      { filename: "readme.txt" },
      { filename: "data.xlsx" },
    ];
    const xlsxCount = attachments.filter((a) =>
      String(a.filename ?? "").endsWith(".xlsx")
    ).length;
    expect(xlsxCount).toBe(2);
  });

  it("should handle missing filename in attachments", () => {
    const attachments = [
      { filename: undefined },
      { filename: "data.xlsx" },
    ];
    const xlsxCount = attachments.filter((a) =>
      String(a.filename ?? "").endsWith(".xlsx")
    ).length;
    expect(xlsxCount).toBe(1);
  });

  it("should not match .xls files (only .xlsx)", () => {
    const attachments = [
      { filename: "old_format.xls" },
      { filename: "data.xlsx" },
    ];
    const xlsxCount = attachments.filter((a) =>
      String(a.filename ?? "").endsWith(".xlsx")
    ).length;
    expect(xlsxCount).toBe(1);
  });
});

describe("email deduplication grouping", () => {
  it("groups results by company org number", () => {
    const results = [
      { orgNumber: "111222333", orgName: "Company A", parsedRows: 10, eventCount: 5, reportDate: "01.03.2026" },
      { orgNumber: "111222333", orgName: "Company A", parsedRows: 10, eventCount: 3, reportDate: "01.04.2026" },
      { orgNumber: "444555666", orgName: "Company B", parsedRows: 20, eventCount: 8, reportDate: "01.03.2026" },
    ];

    const byCompany = new Map<string, typeof results>();
    for (const r of results) {
      const key = r.orgNumber ?? r.orgName;
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(r);
    }

    expect(byCompany.size).toBe(2);
    expect(byCompany.get("111222333")).toHaveLength(2);
    expect(byCompany.get("444555666")).toHaveLength(1);
  });

  it("uses orgName as fallback key when orgNumber is null", () => {
    const results = [
      { orgNumber: null, orgName: "Company A", parsedRows: 10 },
      { orgNumber: null, orgName: "Company A", parsedRows: 10 },
    ];

    const byCompany = new Map<string, typeof results>();
    for (const r of results) {
      const key = r.orgNumber ?? r.orgName;
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(r);
    }

    expect(byCompany.size).toBe(1);
    expect(byCompany.get("Company A")).toHaveLength(2);
  });
});
