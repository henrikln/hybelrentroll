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
  }
): Promise<DbImportResult> {
  // 1. Parse Excel
  const parsed = parseRentRollExcel(buffer);
  const reportDate = parsed.reportDate
    ? parseNorwegianDate(parsed.reportDate) ?? new Date()
    : new Date();

  // 2. Find or create company by org number
  const orgNumber = parsed.orgNumber ?? "unknown";
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

  // 3. Create import record
  const importRecord = await prisma.rentRollImport.create({
    data: {
      accountId,
      companyId: company.id,
      filename: opts.filename,
      source: opts.source,
      senderEmail: opts.senderEmail ?? null,
      status: "processing",
      rowsTotal: parsed.totalRows,
    },
  });

  try {
    // 4. Get previous snapshots for diffing
    const previousSnapshots = await prisma.rentRollSnapshot.findMany({
      where: {
        companyId: company.id,
        importId: {
          not: importRecord.id, // exclude current
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Build a map of latest previous snapshot per unitKey
    const prevSnapshotMap = new Map<string, typeof previousSnapshots[0]>();
    for (const snap of previousSnapshots) {
      if (!prevSnapshotMap.has(snap.unitKey)) {
        prevSnapshotMap.set(snap.unitKey, snap);
      }
    }

    // 5. Process each row in a transaction
    let snapshotCount = 0;
    let eventCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of parsed.rows) {
        const unitKey = buildUnitKey(row);

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

        let contract;
        if (contractWhere) {
          contract = await tx.contract.upsert({
            where: contractWhere,
            update: contractData,
            create: {
              companyId: company.id,
              externalContractId: row.contract.externalContractId,
              ...contractData,
            },
          });
        } else {
          // No external contract ID — find by unit or create
          const existing = await tx.contract.findFirst({
            where: { companyId: company.id, unitId: unit.id },
          });
          if (existing) {
            contract = await tx.contract.update({
              where: { id: existing.id },
              data: contractData,
            });
          } else {
            contract = await tx.contract.create({
              data: {
                companyId: company.id,
                ...contractData,
              },
            });
          }
        }

        // Upsert security deposit
        if (row.security?.securityType) {
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

        // Create snapshot
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
    }, { maxWait: 15000, timeout: 60000 });

    // 6. Mark import as completed
    await prisma.rentRollImport.update({
      where: { id: importRecord.id },
      data: {
        status: "completed",
        rowsImported: parsed.rows.length,
        rowsFailed: parsed.errors.length,
        errorLog: parsed.errors.length > 0
          ? (parsed.errors as unknown as Prisma.InputJsonValue)
          : undefined,
        completedAt: new Date(),
      },
    });

    const properties = [
      ...new Set(parsed.rows.map((r) => `${r.property.streetName} ${r.property.streetNumber}`)),
    ];

    return {
      importId: importRecord.id,
      orgName: parsed.orgName,
      orgNumber: parsed.orgNumber,
      reportDate: parsed.reportDate,
      totalRows: parsed.totalRows,
      parsedRows: parsed.rows.length,
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
