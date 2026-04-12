/**
 * Email ingestion logic.
 * Resolves sender email → account, extracts .xlsx attachments, processes them.
 *
 * Currently uses in-memory allowed senders list.
 * When DB is connected, this will query the allowed_senders table.
 */

import { processRentRoll, type ImportResult } from "../excel/importer";

// In-memory allowed senders (will be DB-backed)
const allowedSenders = new Map<string, { accountId: string; accountName: string }>([
  // Will be populated from DB
]);

export function addAllowedSender(email: string, accountId: string, accountName: string) {
  allowedSenders.set(email.toLowerCase(), { accountId, accountName });
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailProcessingResult {
  senderEmail: string;
  accountId: string | null;
  accountName: string | null;
  attachmentsProcessed: number;
  results: ImportResult[];
  rejected: boolean;
  rejectionReason: string | null;
}

/**
 * Process an inbound email with rent roll attachments.
 */
export function processInboundEmail(
  senderEmail: string,
  attachments: EmailAttachment[]
): EmailProcessingResult {
  const sender = allowedSenders.get(senderEmail.toLowerCase());

  if (!sender) {
    return {
      senderEmail,
      accountId: null,
      accountName: null,
      attachmentsProcessed: 0,
      results: [],
      rejected: true,
      rejectionReason: `Ukjent avsender: ${senderEmail}. Kontakt administrator for å legge til epostadressen.`,
    };
  }

  const xlsxAttachments = attachments.filter(
    (a) =>
      a.filename.endsWith(".xlsx") &&
      (a.contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        a.contentType === "application/octet-stream")
  );

  if (xlsxAttachments.length === 0) {
    return {
      senderEmail,
      accountId: sender.accountId,
      accountName: sender.accountName,
      attachmentsProcessed: 0,
      results: [],
      rejected: true,
      rejectionReason: "Ingen .xlsx-vedlegg funnet i eposten.",
    };
  }

  const results: ImportResult[] = [];
  for (const attachment of xlsxAttachments) {
    try {
      const result = processRentRoll(attachment.content);
      results.push(result);
    } catch (err) {
      results.push({
        orgName: "",
        orgNumber: null,
        reportDate: null,
        totalRows: 0,
        parsedRows: 0,
        errorCount: 1,
        errors: [{ row: 0, field: "file", message: `Feil ved parsing av ${attachment.filename}: ${err}` }],
        properties: [],
        snapshots: [],
        events: [],
      });
    }
  }

  return {
    senderEmail,
    accountId: sender.accountId,
    accountName: sender.accountName,
    attachmentsProcessed: xlsxAttachments.length,
    results,
    rejected: false,
    rejectionReason: null,
  };
}
