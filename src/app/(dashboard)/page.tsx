export const dynamic = "force-dynamic";

import { Banknote, CalendarClock, Building2, Ruler } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PropertyList } from "@/components/dashboard/property-list";
import { formatNOK, formatDecimal } from "@/lib/format";
import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { getSnapshotData } from "@/lib/period";

function toNum(d: { toNumber(): number } | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === "number" ? d : d.toNumber();
}

async function getDataFromLiveTables(accountId: string) {
  const companies = await prisma.company.findMany({
    where: { accountId },
    include: {
      properties: {
        include: {
          units: {
            include: {
              contracts: {
                include: { leaseholder: true },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  const propertyRows = companies.flatMap((company) =>
    company.properties.map((property) => {
      const totalUnits = property.units.length;
      const vacantUnits = property.units.filter((u) => {
        const contract = u.contracts[0];
        return !contract || contract.status === "ledig";
      }).length;
      const annualizedRent = property.units.reduce((sum, u) => {
        const contract = u.contracts[0];
        return sum + (contract ? toNum(contract.monthlyRent) * 12 : 0);
      }, 0);
      const totalArea = property.units.reduce(
        (sum, u) => sum + toNum(u.areaSqm),
        0
      );

      return {
        id: property.id,
        companyName: company.name,
        name: `${property.streetName} ${property.streetNumber}`,
        annualizedRent,
        areaSqm: totalArea,
        totalUnits,
        vacantUnits,
        units: property.units.map((u) => {
          const contract = u.contracts[0];
          return {
            id: u.id,
            unitNumber: u.unitNumber || u.customNumber || "—",
            unitType: u.unitType,
            areaSqm: toNum(u.areaSqm),
            floor: u.floor,
            status: contract?.status ?? "ledig",
            leaseholderName: contract?.leaseholder?.name ?? null,
            monthlyRent: contract ? toNum(contract.monthlyRent) : 0,
          };
        }),
      };
    })
  );

  propertyRows.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const totalAnnualized = propertyRows.reduce(
    (sum, p) => sum + p.annualizedRent,
    0
  );

  const now = new Date();
  let weightedYears = 0;
  let totalRentForWalt = 0;
  for (const company of companies) {
    for (const property of company.properties) {
      for (const unit of property.units) {
        const contract = unit.contracts[0];
        if (contract?.endDate && contract.monthlyRent) {
          const rent = toNum(contract.monthlyRent);
          const yearsLeft = Math.max(
            0,
            (contract.endDate.getTime() - now.getTime()) /
              (365.25 * 24 * 60 * 60 * 1000)
          );
          weightedYears += rent * yearsLeft;
          totalRentForWalt += rent;
        }
      }
    }
  }
  const walt = totalRentForWalt > 0 ? weightedYears / totalRentForWalt : 0;
  const totalArea = propertyRows.reduce((sum, p) => sum + p.areaSqm, 0);

  return { companyCount: companies.length, propertyRows, totalAnnualized, walt, totalArea };
}

function getDataFromSnapshots(
  snapshots: Awaited<ReturnType<typeof getSnapshotData>>
) {
  if (!snapshots) return null;
  const { reportDate, snapshots: snaps } = snapshots;

  // Group snapshots by property address
  const propertyMap = new Map<
    string,
    {
      companyName: string;
      name: string;
      units: typeof snaps;
    }
  >();

  for (const snap of snaps) {
    const addr = `${snap.streetName} ${snap.streetNumber}`;
    // Group by company + address to match live view behavior
    const key = `${snap.company.id}_${addr}`;
    if (!propertyMap.has(key)) {
      propertyMap.set(key, {
        companyName: snap.company.name,
        name: addr,
        units: [],
      });
    }
    propertyMap.get(key)!.units.push(snap);
  }

  const companyNames = new Set<string>();
  const propertyRows = [...propertyMap.entries()].map(([key, prop]) => {
    companyNames.add(prop.companyName);
    const totalUnits = prop.units.length;
    const vacantUnits = prop.units.filter(
      (u) => !u.status || u.status === "ledig"
    ).length;
    const annualizedRent = prop.units.reduce(
      (sum, u) => toNum(u.monthlyRent) * 12 + sum,
      0
    );
    const totalArea = prop.units.reduce(
      (sum, u) => toNum(u.areaSqm) + sum,
      0
    );

    return {
      id: key,
      companyName: prop.companyName,
      name: prop.name,
      annualizedRent,
      areaSqm: totalArea,
      totalUnits,
      vacantUnits,
      units: prop.units.map((u) => ({
        id: u.id,
        unitNumber: u.unitNumber || u.customNumber || "—",
        unitType: u.unitType,
        areaSqm: toNum(u.areaSqm),
        floor: u.floor,
        status: u.status ?? "ledig",
        leaseholderName: u.leaseholderName,
        monthlyRent: toNum(u.monthlyRent),
      })),
    };
  });

  propertyRows.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const totalAnnualized = propertyRows.reduce(
    (sum, p) => sum + p.annualizedRent,
    0
  );

  // WALT from snapshots
  const rd = reportDate;
  let weightedYears = 0;
  let totalRentForWalt = 0;
  for (const snap of snaps) {
    if (snap.endDate && snap.monthlyRent) {
      const rent = toNum(snap.monthlyRent);
      const yearsLeft = Math.max(
        0,
        (snap.endDate.getTime() - rd.getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      );
      weightedYears += rent * yearsLeft;
      totalRentForWalt += rent;
    }
  }
  const walt = totalRentForWalt > 0 ? weightedYears / totalRentForWalt : 0;
  const totalArea = propertyRows.reduce((sum, p) => sum + p.areaSqm, 0);

  return {
    companyCount: companyNames.size,
    propertyRows,
    totalAnnualized,
    walt,
    totalArea,
  };
}

export default async function OversiktPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const accountId = await getAccountId();
  if (!accountId) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-400">
          Ingen data ennå. Last opp en rent roll for å komme i gang.
        </p>
      </div>
    );
  }

  const { period } = await searchParams;

  let data;
  let debugInfo = "";
  if (period) {
    const reportDate = new Date(period);

    // Raw count BEFORE dedup — to see if snapshots exist but are being filtered
    const rawSnapshots = await prisma.rentRollSnapshot.findMany({
      where: { company: { accountId }, reportDate },
      select: { companyId: true, unitKey: true, createdAt: true, streetName: true, streetNumber: true },
      orderBy: [{ companyId: "asc" }, { unitKey: "asc" }, { createdAt: "desc" }],
    });

    // Recent imports for this account
    const recentImports = await prisma.rentRollImport.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        filename: true,
        status: true,
        rowsTotal: true,
        rowsImported: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    });

    const snapData = await getSnapshotData(accountId, period);
    if (snapData) {
      debugInfo = `source=snapshot period=${period} reportDate=${snapData.reportDate.toISOString()}\n`;
      debugInfo += `rawSnapshotCount=${rawSnapshots.length} dedupedCount=${snapData.snapshots.length}\n\n`;

      // Group raw snapshots by company
      const rawByCompany = new Map<string, { unitKeys: string[]; addresses: Set<string> }>();
      for (const s of rawSnapshots) {
        if (!rawByCompany.has(s.companyId)) {
          rawByCompany.set(s.companyId, { unitKeys: [], addresses: new Set() });
        }
        const entry = rawByCompany.get(s.companyId)!;
        entry.unitKeys.push(s.unitKey);
        entry.addresses.add(`${s.streetName} ${s.streetNumber}`);
      }

      // Group deduped by company
      const dedupByCompany = new Map<string, { count: number; name: string; addresses: Set<string> }>();
      for (const s of snapData.snapshots) {
        if (!dedupByCompany.has(s.companyId)) {
          dedupByCompany.set(s.companyId, { count: 0, name: s.company.name, addresses: new Set() });
        }
        const entry = dedupByCompany.get(s.companyId)!;
        entry.count++;
        entry.addresses.add(`${s.streetName} ${s.streetNumber}`);
      }

      debugInfo += `--- per company (deduped / raw) ---\n`;
      for (const [id, dedup] of dedupByCompany) {
        const raw = rawByCompany.get(id);
        debugInfo += `  ${dedup.name} (${id.slice(0, 8)}): ${dedup.count} deduped / ${raw?.unitKeys.length ?? 0} raw\n`;
        debugInfo += `    addresses: ${[...dedup.addresses].join(", ")}\n`;
        if (raw && raw.addresses.size > dedup.addresses.size) {
          debugInfo += `    raw addresses: ${[...raw.addresses].join(", ")}\n`;
        }
      }
      // Show companies that exist in raw but not in deduped
      for (const [id, raw] of rawByCompany) {
        if (!dedupByCompany.has(id)) {
          debugInfo += `  [MISSING] companyId=${id.slice(0, 8)}: ${raw.unitKeys.length} raw snapshots, addresses: ${[...raw.addresses].join(", ")}\n`;
        }
      }

      debugInfo += `\n--- recent imports (last 20) ---\n`;
      for (const imp of recentImports) {
        debugInfo += `  ${imp.createdAt.toISOString().slice(0, 19)} | ${imp.status} | ${imp.company?.name ?? "?"} | ${imp.filename} | rows=${imp.rowsTotal}→${imp.rowsImported}\n`;
      }
    }
    data = getDataFromSnapshots(snapData);
  } else {
    debugInfo = "source=liveTables\n";
    data = await getDataFromLiveTables(accountId);
  }

  if (!data) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-400">
          Ingen data for valgt periode.
        </p>
      </div>
    );
  }

  const { companyCount, propertyRows, totalAnnualized, walt, totalArea } = data;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Oversikt</h1>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Annualisert leie"
          value={`kr ${formatNOK(totalAnnualized)}`}
          icon={Banknote}
          color="green"
        />
        <KpiCard
          label="Totalt areal"
          value={`${formatNOK(totalArea)} m²`}
          icon={Ruler}
          color="blue"
        />
        <KpiCard
          label="WALT"
          value={formatDecimal(walt, 1) + " år"}
          icon={CalendarClock}
          color="purple"
        />
        <KpiCard
          label="Selskaper"
          value={String(companyCount)}
          icon={Building2}
          color="purple"
        />
      </div>

      {/* Property list */}
      <PropertyList properties={propertyRows} />

      {/* Debug info — hidden, copy from DOM inspector */}
      <details className="mt-8 rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs">
        <summary className="cursor-pointer text-gray-400">Debug info</summary>
        <pre className="mt-2 whitespace-pre-wrap text-gray-500">
          {debugInfo}
          {`\nproperties (${propertyRows.length}):\n`}
          {propertyRows.map((p) =>
            `  ${p.name} | ${p.companyName} | units=${p.totalUnits} vacant=${p.vacantUnits} rent=${p.annualizedRent} area=${p.areaSqm}\n`
          ).join("")}
          {`\ntotals: rent=${totalAnnualized} area=${totalArea} walt=${walt.toFixed(2)} companies=${companyCount}`}
        </pre>
      </details>
    </div>
  );
}
