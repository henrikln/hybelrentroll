import { NextRequest, NextResponse } from "next/server";
import { processInboundEmail, type EmailAttachment } from "@/lib/email/inbound";

/**
 * Webhook endpoint for inbound email (Resend Inbound / SendGrid Inbound Parse).
 *
 * Expected POST body (Resend format):
 * {
 *   "from": "henrikln@nagelgaarden.no",
 *   "to": "import@hybelrentroll.no",
 *   "subject": "Rent roll April 2026",
 *   "attachments": [
 *     { "filename": "rentroll.xlsx", "content": "<base64>", "content_type": "..." }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // TODO: Verify webhook signature (Resend HMAC)
    const body = await req.json();

    const senderEmail: string = body.from ?? body.sender ?? "";
    const rawAttachments: Array<{
      filename: string;
      content: string;
      content_type?: string;
      contentType?: string;
    }> = body.attachments ?? [];

    if (!senderEmail) {
      return NextResponse.json({ error: "Missing sender" }, { status: 400 });
    }

    // Convert base64 attachments to buffers
    const attachments: EmailAttachment[] = rawAttachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.content_type ?? a.contentType ?? "application/octet-stream",
    }));

    const result = processInboundEmail(senderEmail, attachments);

    if (result.rejected) {
      // TODO: Send rejection email back to sender via Resend
      console.warn(`Inbound email rejected: ${result.rejectionReason}`);
      return NextResponse.json(
        { status: "rejected", reason: result.rejectionReason },
        { status: 200 } // Return 200 to prevent webhook retries
      );
    }

    // TODO: Send confirmation email back to sender
    console.log(
      `Processed ${result.attachmentsProcessed} attachments from ${result.senderEmail} ` +
        `for account ${result.accountName}`
    );

    return NextResponse.json({
      status: "processed",
      senderEmail: result.senderEmail,
      accountName: result.accountName,
      attachmentsProcessed: result.attachmentsProcessed,
      results: result.results.map((r) => ({
        orgName: r.orgName,
        orgNumber: r.orgNumber,
        reportDate: r.reportDate,
        parsedRows: r.parsedRows,
        events: r.events.length,
        errors: r.errorCount,
      })),
    });
  } catch (err) {
    console.error("Inbound email error:", err);
    return NextResponse.json(
      { error: "Internal error processing email" },
      { status: 500 }
    );
  }
}
