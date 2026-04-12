import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importRentRollToDb, type DbImportResult } from "@/lib/excel/db-importer";

const FROM_EMAIL = "Hybelrentroll <noreply@doodrenios.resend.app>";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[inbound-email] webhook type:", body.type);

    // Resend wraps inbound email data under body.data
    const data = body.data ?? body;

    // Parse sender — Resend formats as "Name <email>" or just "email"
    const rawFrom: string = data.from ?? "";
    const senderEmail = parseEmailAddress(rawFrom);
    const emailId: string | undefined = data.email_id;

    console.log(`[inbound-email] from="${rawFrom}", parsed="${senderEmail}", email_id=${emailId}`);

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
      await sendErrorEmail(
        senderEmail,
        "Ukjent avsender",
        `E-postadressen ${senderEmail} er ikke registrert i systemet. Be en administrator om å legge til adressen under Avsendere i dashboardet.`
      );
      return NextResponse.json(
        { status: "rejected", reason: `Ukjent avsender: ${senderEmail}` },
        { status: 200 }
      );
    }

    // 2. Fetch attachments from Resend API
    // Webhook only includes metadata — we need to download actual files
    const attachmentMeta: Array<{
      id: string;
      filename: string;
      content_type?: string;
    }> = data.attachments ?? [];

    const xlsxMeta = attachmentMeta.filter((a) =>
      a.filename?.endsWith(".xlsx")
    );

    console.log(`[inbound-email] attachments=${attachmentMeta.length}, xlsx=${xlsxMeta.length}`);

    if (xlsxMeta.length === 0) {
      await sendErrorEmail(
        senderEmail,
        "Ingen .xlsx-vedlegg",
        "E-posten inneholdt ingen .xlsx-vedlegg. Kun Excel-filer (.xlsx) støttes."
      );
      return NextResponse.json(
        { status: "rejected", reason: "Ingen .xlsx-vedlegg funnet" },
        { status: 200 }
      );
    }

    if (!emailId || !process.env.RESEND_API_KEY) {
      console.error("[inbound-email] Missing email_id or RESEND_API_KEY — cannot fetch attachments");
      return NextResponse.json(
        { error: "Cannot fetch attachments without email_id and API key" },
        { status: 500 }
      );
    }

    // Download attachment content via Resend API
    const attachmentFiles = await fetchAttachments(emailId, xlsxMeta);

    if (attachmentFiles.length === 0) {
      await sendErrorEmail(
        senderEmail,
        "Kunne ikke laste ned vedlegg",
        "Vedleggene kunne ikke lastes ned. Prøv å sende e-posten på nytt."
      );
      return NextResponse.json(
        { status: "failed", reason: "Could not download attachments" },
        { status: 500 }
      );
    }

    // 3. Process each attachment
    const results: DbImportResult[] = [];
    const errors: string[] = [];

    for (const attachment of attachmentFiles) {
      try {
        const result = await importRentRollToDb(attachment.buffer, sender.accountId, {
          filename: attachment.filename,
          source: "email",
          senderEmail,
        });

        if (result.errorCount > 0) {
          errors.push(
            `${attachment.filename}: ${result.errorCount} feil ved parsing. ` +
            `Sjekk at filen har eksakt samme format som tidligere innsendte filer.`
          );
        }

        results.push(result);
        console.log(
          `[inbound-email] Imported ${attachment.filename}: ` +
            `${result.parsedRows} rows, ${result.eventCount} events`
        );
      } catch (err) {
        const msg = `Feil ved behandling av ${attachment.filename}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        console.error(`[inbound-email] ${msg}`);
      }
    }

    // 4. Send response email
    if (process.env.RESEND_API_KEY) {
      try {
        if (results.length > 0) {
          await sendSuccessEmail(senderEmail, results);
        }
        if (errors.length > 0) {
          await sendErrorEmail(
            senderEmail,
            "Feil ved import",
            errors.join("\n\n") +
              "\n\nSjekk at filformatet er eksakt som tidligere innsendte filer (samme kolonner, samme rekkefølge)."
          );
        }
      } catch (emailErr) {
        console.error("[inbound-email] Failed to send email:", emailErr);
      }
    }

    return NextResponse.json({
      status: results.length > 0 ? "processed" : "failed",
      senderEmail,
      accountName: sender.account.name,
      results: results.map((r) => ({
        importId: r.importId,
        orgName: r.orgName,
        parsedRows: r.parsedRows,
        eventCount: r.eventCount,
        errorCount: r.errorCount,
      })),
      errors,
    });
  } catch (err) {
    console.error("[inbound-email] Error:", err);
    return NextResponse.json(
      { error: "Internal error processing email" },
      { status: 500 }
    );
  }
}

/** Extract email address from "Name <email>" or bare "email" format */
function parseEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  // Might be a bare email
  const trimmed = raw.toLowerCase().trim();
  return trimmed.includes("@") ? trimmed : "";
}

/** Fetch attachment files from Resend API */
async function fetchAttachments(
  emailId: string,
  xlsxMeta: Array<{ id: string; filename: string }>
): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const files: Array<{ filename: string; buffer: Buffer }> = [];

  try {
    // GET /emails/{email_id}/attachments returns array with download_url
    const res = await fetch(`https://api.resend.com/emails/${emailId}/attachments`, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
    });

    if (!res.ok) {
      console.error(`[inbound-email] Attachments API error ${res.status}: ${await res.text()}`);
      return files;
    }

    const allAttachments: Array<{
      id: string;
      filename: string;
      content_type: string;
      download_url?: string;
      content?: string;
    }> = await res.json();

    console.log(`[inbound-email] Fetched ${allAttachments.length} attachments from API`);

    for (const meta of xlsxMeta) {
      const att = allAttachments.find((a) => a.id === meta.id || a.filename === meta.filename);
      if (!att) {
        console.warn(`[inbound-email] Attachment not found: ${meta.filename}`);
        continue;
      }

      if (att.content) {
        // Base64 content directly available
        files.push({ filename: meta.filename, buffer: Buffer.from(att.content, "base64") });
      } else if (att.download_url) {
        // Download from signed URL
        const dlRes = await fetch(att.download_url);
        if (dlRes.ok) {
          const arrayBuffer = await dlRes.arrayBuffer();
          files.push({ filename: meta.filename, buffer: Buffer.from(arrayBuffer) });
        } else {
          console.error(`[inbound-email] Download failed for ${meta.filename}: ${dlRes.status}`);
        }
      }
    }
  } catch (err) {
    console.error("[inbound-email] Error fetching attachments:", err);
  }

  return files;
}

async function sendSuccessEmail(to: string, results: DbImportResult[]) {
  const totalProperties = results.reduce((s, r) => s + r.properties.length, 0);
  const totalUnits = results.reduce((s, r) => s + r.parsedRows, 0);

  const details = results
    .map((r) => {
      const annualized = r.parsedRows > 0 ? `${r.parsedRows} enheter` : "0 enheter";
      return (
        `${r.orgName}\n` +
        `  Eiendommer: ${r.properties.length} (${r.properties.join(", ")})\n` +
        `  Enheter: ${annualized}\n` +
        `  Hendelser: ${r.eventCount}`
      );
    })
    .join("\n\n");

  await resendEmail(to, "Import fullført", [
    `Hei!`,
    ``,
    `Din rent roll er importert.`,
    ``,
    `Totalt: ${totalProperties} eiendommer, ${totalUnits} enheter`,
    ``,
    details,
    ``,
    `Se detaljer på https://hybelrentroll.vercel.app`,
    ``,
    `— Hybelrentroll`,
  ].join("\n"));
}

async function sendErrorEmail(to: string, subject: string, body: string) {
  if (!process.env.RESEND_API_KEY) return;

  await resendEmail(to, subject, [
    `Hei!`,
    ``,
    body,
    ``,
    `Ta kontakt med administrator hvis problemet vedvarer.`,
    ``,
    `— Hybelrentroll`,
  ].join("\n"));
}

async function resendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
