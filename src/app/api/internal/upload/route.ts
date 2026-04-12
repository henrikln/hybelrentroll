import { NextRequest, NextResponse } from "next/server";
import { parseRentRollExcel } from "@/lib/excel/parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Ingen fil lastet opp" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Kun .xlsx-filer støttes" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseRentRollExcel(buffer);

    // Get unique property addresses
    const properties = [
      ...new Set(
        result.rows.map((r) => `${r.property.streetName} ${r.property.streetNumber}`)
      ),
    ];

    // TODO: When DB is connected, call importer.ts to upsert data

    return NextResponse.json({
      orgName: result.orgName,
      orgNumber: result.orgNumber,
      reportDate: result.reportDate,
      totalRows: result.totalRows,
      parsedRows: result.rows.length,
      errorCount: result.errors.length,
      errors: result.errors,
      properties,
      rows: result.rows,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Feil ved behandling av fil" },
      { status: 500 }
    );
  }
}
