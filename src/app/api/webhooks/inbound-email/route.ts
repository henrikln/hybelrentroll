import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importRentRollToDb, type DbImportResult } from "@/lib/excel/db-importer";

const FROM_EMAIL = "Hybel.no Viewer <noreply@estatelab.amp11.no>";

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

    // Idempotency: skip if we already processed this email.
    // Check both emailId (new imports) and recent imports from same sender (catches old imports without emailId).
    if (emailId) {
      const alreadyImported = await prisma.rentRollImport.findFirst({
        where: { emailId },
        select: { id: true },
      });
      if (alreadyImported) {
        console.log(`[inbound-email] Already processed email_id=${emailId}, skipping`);
        return NextResponse.json({ status: "already_processed", emailId });
      }
    }

    // Also check if we recently processed imports from this sender (within 5 min)
    // This catches Resend retries for old emails that don't have emailId stored
    const recentCutoff = new Date(Date.now() - 5 * 60 * 1000);
    const recentImport = await prisma.rentRollImport.findFirst({
      where: {
        senderEmail,
        createdAt: { gt: recentCutoff },
      },
      select: { id: true },
    });
    if (recentImport) {
      console.log(`[inbound-email] Recent import from ${senderEmail} within 5min, skipping retry`);
      return NextResponse.json({ status: "skipped_recent", senderEmail });
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

    // 2. Check webhook has xlsx attachments
    const webhookAttachments: Array<{ filename?: string }> = data.attachments ?? [];
    const xlsxCount = webhookAttachments.filter((a) =>
      String(a.filename ?? "").endsWith(".xlsx")
    ).length;

    console.log(`[inbound-email] webhook attachments=${webhookAttachments.length}, xlsx=${xlsxCount}`);

    if (xlsxCount === 0) {
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
      console.error("[inbound-email] Missing email_id or RESEND_API_KEY");
      return NextResponse.json(
        { error: "Cannot fetch attachments" },
        { status: 500 }
      );
    }

    // Fetch actual attachment content via Resend receiving API
    const attachmentFiles = await fetchReceivedAttachments(emailId);

    if (attachmentFiles.length === 0) {
      await sendErrorEmail(
        senderEmail,
        "Kunne ikke laste ned vedlegg",
        "Vedleggene kunne ikke lastes ned fra e-posten. Prøv å sende på nytt."
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
          emailId,
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

/** Fetch attachment files via Resend receiving API */
async function fetchReceivedAttachments(
  emailId: string
): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const files: Array<{ filename: string; buffer: Buffer }> = [];

  try {
    // GET /emails/receiving/{email_id}/attachments
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}/attachments`,
      {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      }
    );

    if (!res.ok) {
      console.error(`[inbound-email] Receiving attachments API ${res.status}: ${await res.text()}`);
      return files;
    }

    const json = await res.json();
    const attachments: Array<{
      id: string;
      filename: string;
      content_type: string;
      download_url: string;
    }> = json.data ?? json;

    console.log(`[inbound-email] API returned ${attachments.length} attachments`);

    for (const att of attachments) {
      if (!att.filename?.endsWith(".xlsx")) continue;

      console.log(`[inbound-email] Downloading ${att.filename} from ${att.download_url?.substring(0, 60)}...`);
      const dlRes = await fetch(att.download_url);
      if (dlRes.ok) {
        const arrayBuffer = await dlRes.arrayBuffer();
        files.push({ filename: att.filename, buffer: Buffer.from(arrayBuffer) });
        console.log(`[inbound-email] Downloaded ${att.filename}: ${arrayBuffer.byteLength} bytes`);
      } else {
        console.error(`[inbound-email] Download failed for ${att.filename}: ${dlRes.status}`);
      }
    }
  } catch (err) {
    console.error("[inbound-email] Error fetching attachments:", err);
  }

  return files;
}

async function sendSuccessEmail(to: string, results: DbImportResult[]) {
  // Deduplicate totals across files for the same company
  const allProperties = new Set<string>();
  const allUnits = new Set<string>();
  for (const r of results) {
    for (const p of r.properties) allProperties.add(p);
    // Use orgName + parsedRows as a rough unique unit count per company
    allUnits.add(`${r.orgNumber ?? r.orgName}`);
  }
  // Group results by company for cleaner summary
  const byCompany = new Map<string, DbImportResult[]>();
  for (const r of results) {
    const key = r.orgNumber ?? r.orgName;
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(r);
  }

  const details = [...byCompany.values()]
    .map((companyResults) => {
      const r = companyResults[0];
      const dates = companyResults
        .map((cr) => cr.reportDate ?? "ukjent dato")
        .sort()
        .join(", ");
      return (
        `${r.orgName}\n` +
        `  Rapportdatoer: ${dates}\n` +
        `  Eiendommer: ${r.properties.length} (${r.properties.join(", ")})\n` +
        `  Enheter: ${r.parsedRows}\n` +
        `  Hendelser: ${companyResults.reduce((s, cr) => s + cr.eventCount, 0)}`
      );
    })
    .join("\n\n");

  // Use first result per company for unique unit count
  const uniqueUnits = [...byCompany.values()].reduce(
    (s, cr) => s + cr[0].parsedRows,
    0
  );

  await resendEmail(to, "Import fullført", [
    `Hei!`,
    ``,
    `Din rent roll er importert.`,
    ``,
    `Totalt: ${allProperties.size} eiendommer, ${uniqueUnits} enheter, ${results.length} filer`,
    ``,
    details,
    ``,
    `Se detaljer på https://hybelrentroll.vercel.app`,
    ``,
    `— Hybel.no Viewer`,
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
    `— Hybel.no Viewer`,
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
