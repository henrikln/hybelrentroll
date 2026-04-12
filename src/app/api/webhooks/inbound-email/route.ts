import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importRentRollToDb } from "@/lib/excel/db-importer";

/**
 * Webhook endpoint for inbound email (Resend).
 *
 * Resend POST body:
 * {
 *   "from": "henrikln@nagelgaarden.no",
 *   "to": "import@send.estatelab.ampeleven.no",
 *   "subject": "Rent roll April 2026",
 *   "attachments": [
 *     { "filename": "rentroll.xlsx", "content": "<base64>", "content_type": "..." }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const senderEmail: string = (
      body.from ?? body.sender ?? ""
    ).toLowerCase().trim();

    const rawAttachments: Array<{
      filename: string;
      content: string;
      content_type?: string;
      contentType?: string;
    }> = body.attachments ?? [];

    console.log(`[inbound-email] from=${senderEmail}, attachments=${rawAttachments.length}`);

    if (!senderEmail) {
      return NextResponse.json({ error: "Missing sender" }, { status: 400 });
    }

    // 1. Look up sender → account
    const sender = await prisma.allowedSender.findUnique({
      where: { email: senderEmail },
      include: { account: true },
    });

    if (!sender) {
      console.warn(`[inbound-email] Unknown sender: ${senderEmail}`);
      // TODO: send rejection email via Resend
      return NextResponse.json(
        { status: "rejected", reason: `Ukjent avsender: ${senderEmail}` },
        { status: 200 } // 200 to prevent webhook retries
      );
    }

    // 2. Filter xlsx attachments
    const xlsxAttachments = rawAttachments.filter(
      (a) =>
        a.filename.endsWith(".xlsx") &&
        (a.content_type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          a.contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          a.content_type === "application/octet-stream" ||
          a.contentType === "application/octet-stream")
    );

    if (xlsxAttachments.length === 0) {
      console.warn(`[inbound-email] No .xlsx attachments from ${senderEmail}`);
      return NextResponse.json(
        { status: "rejected", reason: "Ingen .xlsx-vedlegg funnet" },
        { status: 200 }
      );
    }

    // 3. Process each attachment
    const results = [];
    for (const attachment of xlsxAttachments) {
      const buffer = Buffer.from(attachment.content, "base64");
      const result = await importRentRollToDb(buffer, sender.accountId, {
        filename: attachment.filename,
        source: "email",
        senderEmail,
      });
      results.push(result);
      console.log(
        `[inbound-email] Imported ${attachment.filename}: ` +
          `${result.parsedRows} rows, ${result.eventCount} events`
      );
    }

    // 4. Send confirmation email via Resend (if API key is configured)
    if (process.env.RESEND_API_KEY) {
      try {
        await sendConfirmationEmail(senderEmail, results);
      } catch (emailErr) {
        console.error("[inbound-email] Failed to send confirmation:", emailErr);
      }
    }

    return NextResponse.json({
      status: "processed",
      senderEmail,
      accountName: sender.account.name,
      results: results.map((r) => ({
        importId: r.importId,
        orgName: r.orgName,
        parsedRows: r.parsedRows,
        eventCount: r.eventCount,
        errorCount: r.errorCount,
      })),
    });
  } catch (err) {
    console.error("[inbound-email] Error:", err);
    return NextResponse.json(
      { error: "Internal error processing email" },
      { status: 500 }
    );
  }
}

async function sendConfirmationEmail(
  to: string,
  results: Array<{
    orgName: string;
    parsedRows: number;
    eventCount: number;
    errorCount: number;
    properties: string[];
  }>
) {
  const summary = results
    .map(
      (r) =>
        `• ${r.orgName}: ${r.parsedRows} enheter importert, ${r.eventCount} hendelser` +
        (r.errorCount > 0 ? ` (${r.errorCount} feil)` : "")
    )
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Hybelrentroll <noreply@send.estatelab.ampeleven.no>",
      to: [to],
      subject: "Import fullført",
      text: `Hei!\n\nDin rent roll er importert:\n\n${summary}\n\nSe detaljer på https://hybelrentroll.vercel.app\n\n— Hybelrentroll`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
