/**
 * DB-backed import orchestrator.
 * parse Excel → find/create company → upsert properties/units/contracts →
 * create snapshots → diff against previous → generate events.
 */

import { prisma } from "@/lib/db";
import { parseRentRollExcel } from "./parser";
import { buildUnitKey, diffSnapshots, type SnapshotData } from "./differ";
import type { ParsedRow } from "./validators";
import { parseNorwegianDate } from "../format";
import type { Prisma, ImportSource } from "@prisma/client";

export interface DbImportResult {
  importId: string;
  orgName: string;
  orgNumber: string | null;
  reportDate: string | null;
  totalRows: number;
  parsedRows: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
  properties: string[];
  snapshotCount: number;
  eventCount: number;
}

/**
 * Full import pipeline: parse Excel buffer and save everything to DB.
 */
export async function importRentRollToDb(
  buffer: Buffer | ArrayBuffer,
  accountId: string,
  opts: {
    filename: string;
    source: ImportSource;
    senderEmail?: string;
    emailId?: string;
  }
): Promise<DbImportResult> {
  // 1. Parse Excel
  const parsed = parseRentRollExcel(buffer);

  // Report date MUST come from the file — never fabricate one
  if (!parsed.reportDate) {
    throw new Error(
      "Kunne ikke lese rapportdato fra filen. Første linje må inneholde dato på formatet DD.MM.YYYY."
    );
  }
  const reportDate = parseNorwegianDate(parsed.reportDate);
  if (!reportDate) {
    throw new Error(
      `Ugyldig rapportdato "${parsed.reportDate}". Forventet format DD.MM.YYYY.`
    );
  }
  if (reportDate.getFullYear() < 2000 || reportDate.getFullYear() > 2100) {
    throw new Error(
      `Urealistisk rapportdato: ${parsed.reportDate}. Forventet dato mellom 2000 og 2100.`
    );
  }

  // 2. Find or create company by org number
  if (!parsed.orgNumber) {
    throw new Error(
      "Kunne ikke lese organisasjonsnummer fra filen. Første linje må inneholde orgnr i parentes, f.eks. (123456789)."
    );
  }
  const orgNumber = parsed.orgNumber;
  const company = await prisma.company.upsert({
    where: {
      accountId_orgNumber: { accountId, orgNumber },
    },
    update: { name: parsed.orgName },
    create: {
      accountId,
      name: parsed.orgName,
      orgNumber,
    },
  });

  // 3. Handle duplicates — a file for a given company+date is the truth for that date
  //    Delete existing imports for the same company and report date.
  //    BUT: exclude imports from the same email batch (same emailId) — multiple files
  //    for the same company can arrive in one email and should coexist.
  const existingImports = await prisma.rentRollImport.findMany({
    where: {
      companyId: company.id,
      snapshots: { some: { reportDate } },
      ...(opts.emailId ? { NOT: { emailId: opts.emailId } } : {}),
    },
    select: { id: true },
  });

  if (existingImports.length > 0) {
    const importIds = existingImports.map((i) => i.id);
    // Cascade: delete snapshots and events for these imports
    await prisma.unitEvent.deleteMany({
      where: { importId: { in: importIds } },
    });
    await prisma.rentRollSnapshot.deleteMany({
      where: { importId: { in: importIds } },
    });
    await prisma.rentRollImport.deleteMany({
      where: { id: { in: importIds } },
    });
  }

  // 4. Create import record
  const importRecord = await prisma.rentRollImport.create({
    data: {
      accountId,
      companyId: company.id,
      filename: opts.filename,
      source: opts.source,
      senderEmail: opts.senderEmail ?? null,
      emailId: opts.emailId ?? null,
      status: "processing",
      rowsTotal: parsed.totalRows,
    },
  });

  try {
    // 5. Get previous chronological snapshots for diffing
    //    Find the latest snapshot with reportDate BEFORE current, regardless of import order
    const previousSnapshots = await prisma.rentRollSnapshot.findMany({
      where: {
        companyId: company.id,
        reportDate: { lt: reportDate },
      },
      orderBy: { reportDate: "desc" },
    });

    // Build a map of latest previous snapshot per unitKey (closest earlier date)
    const prevSnapshotMap = new Map<string, typeof previousSnapshots[0]>();
    for (const snap of previousSnapshots) {
      if (!prevSnapshotMap.has(snap.unitKey)) {
        prevSnapshotMap.set(snap.unitKey, snap);
      }
    }

    // 7. Deduplicate rows by unitKey — Excel files often contain both old
    //    (ledig) and new (aktiv) contract rows for the same unit. We keep
    //    the "aktiv" row, or the one with the latest startDate if tied.
    const rowsByKey = new Map<string, ParsedRow>();
    for (const row of parsed.rows) {
      const key = buildUnitKey(row);
      const existing = rowsByKey.get(key);
      if (!existing) {
        rowsByKey.set(key, row);
        continue;
      }
      // Prefer aktiv over ledig
      const existingStatus = existing.contract.status.toLowerCase();
      const newStatus = row.contract.status.toLowerCase();
      if (existingStatus === "aktiv" && newStatus !== "aktiv") continue;
      if (newStatus === "aktiv" && existingStatus !== "aktiv") {
        rowsByKey.set(key, row);
        continue;
      }
      // Same status — prefer later startDate
      const existingStart = existing.contract.startDate?.getTime() ?? 0;
      const newStart = row.contract.startDate?.getTime() ?? 0;
      if (newStart > existingStart) {
        rowsByKey.set(key, row);
      }
    }
    const deduplicatedRows = [...rowsByKey.values()];

    // 8. Process each row in a transaction
    let snapshotCount = 0;
    let eventCount = 0;

    await prisma.$transaction(async (tx) => {
      // Determine if this is the latest report for the company
      // Done inside transaction for consistency
      const newerSnapshot = await tx.rentRollSnapshot.findFirst({
        where: {
          companyId: company.id,
          reportDate: { gt: reportDate },
        },
      });
      const isLatestReport = !newerSnapshot;

      for (const row of deduplicatedRows) {
        const unitKey = buildUnitKey(row);

        // Update current-state tables only if this is the latest report
        if (isLatestReport) {
          // Upsert property
          const property = await tx.property.upsert({
            where: {
              companyId_streetName_streetNumber_postalCode_gnr_bnr: {
                companyId: company.id,
                streetName: row.property.streetName,
                streetNumber: row.property.streetNumber,
                postalCode: row.property.postalCode,
                gnr: row.property.gnr ?? 0,
                bnr: row.property.bnr ?? 0,
              },
            },
            update: {
              postalPlace: row.property.postalPlace,
              municipality: row.property.municipality,
            },
            create: {
              companyId: company.id,
              streetName: row.property.streetName,
              streetNumber: row.property.streetNumber,
              postalCode: row.property.postalCode,
              postalPlace: row.property.postalPlace,
              municipality: row.property.municipality,
              gnr: row.property.gnr ?? 0,
              bnr: row.property.bnr ?? 0,
              snr: row.property.snr,
            },
          });

          // Upsert unit
          const unit = await tx.unit.upsert({
            where: {
              propertyId_unitNumber_customNumber: {
                propertyId: property.id,
                unitNumber: row.unit.unitNumber ?? "",
                customNumber: row.unit.customNumber ?? "",
              },
            },
            update: {
              unitType: row.unit.unitType as never,
              numRooms: row.unit.numRooms,
              areaSqm: row.unit.areaSqm,
              numBedrooms: row.unit.numBedrooms,
              floor: row.unit.floor,
            },
            create: {
              companyId: company.id,
              propertyId: property.id,
              unitNumber: row.unit.unitNumber ?? "",
              customNumber: row.unit.customNumber ?? "",
              unitType: row.unit.unitType as never,
              numRooms: row.unit.numRooms,
              areaSqm: row.unit.areaSqm,
              numBedrooms: row.unit.numBedrooms,
              floor: row.unit.floor,
            },
          });

          // Upsert leaseholder (if present)
          let leaseholderId: string | null = null;
          if (row.tenant?.name) {
            const leaseholder = await tx.leaseholder.upsert({
              where: {
                companyId_name_email: {
                  companyId: company.id,
                  name: row.tenant.name,
                  email: row.tenant.email ?? "",
                },
              },
              update: {
                phone: row.tenant.phone,
                invoiceEmail: row.tenant.invoiceEmail,
              },
              create: {
                companyId: company.id,
                name: row.tenant.name,
                email: row.tenant.email ?? "",
                phone: row.tenant.phone,
                invoiceEmail: row.tenant.invoiceEmail,
              },
            });
            leaseholderId = leaseholder.id;
          }

          // Upsert contract
          const contractWhere = row.contract.externalContractId
            ? {
                companyId_externalContractId: {
                  companyId: company.id,
                  externalContractId: row.contract.externalContractId,
                },
              }
            : undefined;

          const contractData = {
            unitId: unit.id,
            leaseholderId,
            status: row.contract.status as never,
            contractType: row.contract.contractType as never,
            startDate: row.contract.startDate,
            endDate: row.contract.endDate,
            terminationDate: row.contract.terminationDate,
            noticePeriodMonths: row.contract.noticePeriodMonths,
            earliestNoticeDate: row.contract.earliestNoticeDate,
            monthlyRent: row.contract.monthlyRent,
            fixedReduction: row.contract.fixedReduction,
            lastRentAdjustmentDate: row.contract.lastRentAdjustmentDate,
            nextRentAdjustmentDate: row.contract.nextRentAdjustmentDate,
            rentBeforeLastAdjustment: row.contract.rentBeforeLastAdjustment,
            cpiBase: row.contract.cpiBase,
            akontoElectricity: row.contract.akontoElectricity,
            akontoWaterSewage: row.contract.akontoWaterSewage,
          };

          // Ensure only one contract per unit — delete any other contracts
          // for this unit before upserting the current one. The Excel file
          // may contain historical contract rows (old + new) for the same unit.
          if (contractWhere) {
            // Delete ALL other contracts for this unit (different extId or null)
            await tx.contract.deleteMany({
              where: {
                companyId: company.id,
                unitId: unit.id,
                externalContractId: { not: row.contract.externalContractId },
              },
            });

            await tx.contract.upsert({
              where: contractWhere,
              update: contractData,
              create: {
                companyId: company.id,
                externalContractId: row.contract.externalContractId,
                ...contractData,
              },
            });
          } else {
            // No externalContractId — find or create by unit
            const existing = await tx.contract.findMany({
              where: { companyId: company.id, unitId: unit.id },
            });
            if (existing.length > 0) {
              // Keep the first, delete any extras
              if (existing.length > 1) {
                await tx.contract.deleteMany({
                  where: {
                    id: { in: existing.slice(1).map((c) => c.id) },
                  },
                });
              }
              await tx.contract.update({
                where: { id: existing[0].id },
                data: contractData,
              });
            } else {
              await tx.contract.create({
                data: {
                  companyId: company.id,
                  ...contractData,
                },
              });
            }
          }

          // Upsert security deposit
          if (row.security?.securityType) {
            const contract = await tx.contract.findFirst({
              where: { companyId: company.id, unitId: unit.id },
            });
            if (contract) {
              await tx.securityDeposit.upsert({
                where: { contractId: contract.id },
                update: {
                  securityType: row.security.securityType as never,
                  amount: row.security.amount,
                },
                create: {
                  companyId: company.id,
                  contractId: contract.id,
                  securityType: row.security.securityType as never,
                  amount: row.security.amount,
                },
              });
            }
          }
        }

        // Always create snapshot (regardless of whether this is latest)
        await tx.rentRollSnapshot.create({
          data: {
            importId: importRecord.id,
            companyId: company.id,
            reportDate,
            unitKey,
            streetName: row.property.streetName,
            streetNumber: row.property.streetNumber,
            postalCode: row.property.postalCode,
            postalPlace: row.property.postalPlace,
            gnr: row.property.gnr,
            bnr: row.property.bnr,
            unitNumber: row.unit.unitNumber,
            customNumber: row.unit.customNumber,
            unitType: row.unit.unitType,
            numRooms: row.unit.numRooms,
            areaSqm: row.unit.areaSqm,
            numBedrooms: row.unit.numBedrooms,
            floor: row.unit.floor,
            externalContractId: row.contract.externalContractId,
            status: row.contract.status,
            contractType: row.contract.contractType,
            startDate: row.contract.startDate,
            endDate: row.contract.endDate,
            noticePeriodMonths: row.contract.noticePeriodMonths,
            earliestNoticeDate: row.contract.earliestNoticeDate,
            monthlyRent: row.contract.monthlyRent,
            fixedReduction: row.contract.fixedReduction,
            lastRentAdjDate: row.contract.lastRentAdjustmentDate,
            nextRentAdjDate: row.contract.nextRentAdjustmentDate,
            rentBeforeLastAdj: row.contract.rentBeforeLastAdjustment,
            cpiBase: row.contract.cpiBase,
            akontoElectricity: row.contract.akontoElectricity,
            akontoWaterSewage: row.contract.akontoWaterSewage,
            leaseholderName: row.tenant?.name ?? null,
            leaseholderEmail: row.tenant?.email ?? null,
            leaseholderPhone: row.tenant?.phone ?? null,
            securityType: row.security?.securityType ?? null,
            securityAmount: row.security?.amount ?? null,
          },
        });
        snapshotCount++;

        // Diff against previous snapshot
        const prevSnap = prevSnapshotMap.get(unitKey);
        const currData = rowToSnapshotData(row, unitKey);
        const prevData = prevSnap ? dbSnapToSnapshotData(prevSnap) : null;
        const events = diffSnapshots(prevData, currData);

        for (const event of events) {
          await tx.unitEvent.create({
            data: {
              companyId: company.id,
              importId: importRecord.id,
              unitKey: event.unitKey,
              eventDate: reportDate,
              eventType: event.eventType,
              description: event.description,
              oldValue: event.oldValue as Prisma.InputJsonValue ?? undefined,
              newValue: event.newValue as Prisma.InputJsonValue ?? undefined,
            },
          });
          eventCount++;
        }
      }
    }, { maxWait: 15000, timeout: 120000 });

    // Mark import as completed
    await prisma.rentRollImport.update({
      where: { id: importRecord.id },
      data: {
        status: "completed",
        rowsImported: deduplicatedRows.length,
        rowsFailed: parsed.errors.length,
        errorLog: parsed.errors.length > 0
          ? (parsed.errors as unknown as Prisma.InputJsonValue)
          : undefined,
        completedAt: new Date(),
      },
    });

    const properties = [
      ...new Set(deduplicatedRows.map((r) => `${r.property.streetName} ${r.property.streetNumber}`)),
    ];

    return {
      importId: importRecord.id,
      orgName: parsed.orgName,
      orgNumber: parsed.orgNumber,
      reportDate: parsed.reportDate,
      totalRows: parsed.totalRows,
      parsedRows: deduplicatedRows.length,
      errorCount: parsed.errors.length,
      errors: parsed.errors,
      properties,
      snapshotCount,
      eventCount,
    };
  } catch (error) {
    // Mark import as failed
    await prisma.rentRollImport.update({
      where: { id: importRecord.id },
      data: {
        status: "failed",
        errorLog: { error: String(error) } as Prisma.InputJsonValue,
      },
    });
    throw error;
  }
}

function rowToSnapshotData(row: ParsedRow, unitKey: string): SnapshotData {
  return {
    unitKey,
    status: row.contract.status,
    leaseholderName: row.tenant?.name ?? null,
    leaseholderEmail: row.tenant?.email ?? null,
    monthlyRent: row.contract.monthlyRent,
    fixedReduction: row.contract.fixedReduction,
    endDate: row.contract.endDate,
    startDate: row.contract.startDate,
    contractType: row.contract.contractType,
    externalContractId: row.contract.externalContractId,
    lastRentAdjDate: row.contract.lastRentAdjustmentDate,
    securityType: row.security?.securityType ?? null,
    securityAmount: row.security?.amount ?? null,
    akontoElectricity: row.contract.akontoElectricity,
    akontoWaterSewage: row.contract.akontoWaterSewage,
    customNumber: row.unit.customNumber,
  };
}

function dbSnapToSnapshotData(snap: {
  unitKey: string;
  status: string;
  leaseholderName: string | null;
  leaseholderEmail: string | null;
  monthlyRent: Prisma.Decimal | null;
  fixedReduction: Prisma.Decimal | null;
  endDate: Date | null;
  startDate: Date | null;
  contractType: string | null;
  externalContractId: string | null;
  lastRentAdjDate: Date | null;
  securityType: string | null;
  securityAmount: Prisma.Decimal | null;
  akontoElectricity: Prisma.Decimal | null;
  akontoWaterSewage: Prisma.Decimal | null;
  customNumber: string | null;
}): SnapshotData {
  return {
    unitKey: snap.unitKey,
    status: snap.status,
    leaseholderName: snap.leaseholderName,
    leaseholderEmail: snap.leaseholderEmail,
    monthlyRent: snap.monthlyRent?.toNumber() ?? null,
    fixedReduction: snap.fixedReduction?.toNumber() ?? null,
    endDate: snap.endDate,
    startDate: snap.startDate,
    contractType: snap.contractType,
    externalContractId: snap.externalContractId,
    lastRentAdjDate: snap.lastRentAdjDate,
    securityType: snap.securityType,
    securityAmount: snap.securityAmount?.toNumber() ?? null,
    akontoElectricity: snap.akontoElectricity?.toNumber() ?? null,
    akontoWaterSewage: snap.akontoWaterSewage?.toNumber() ?? null,
    customNumber: snap.customNumber,
  };
}
