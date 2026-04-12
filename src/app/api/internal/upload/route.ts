import { NextRequest, NextResponse } from "next/server";
import { processRentRoll } from "@/lib/excel/importer";

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
    const result = processRentRoll(buffer);

    return NextResponse.json({
      orgName: result.orgName,
      orgNumber: result.orgNumber,
      reportDate: result.reportDate,
      totalRows: result.totalRows,
      parsedRows: result.parsedRows,
      errorCount: result.errorCount,
      errors: result.errors,
      properties: result.properties,
      events: result.events,
      snapshotCount: result.snapshots.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Feil ved behandling av fil" },
      { status: 500 }
    );
  }
}
