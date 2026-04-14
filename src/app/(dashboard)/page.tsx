export const dynamic = "force-dynamic";

import {
  Banknote,
  CalendarClock,
  Building2,
  Ruler,
  UserPlus,
  UserMinus,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Plus,
  ArrowUpDown,
  Shield,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PropertyList } from "@/components/dashboard/property-list";
import { formatNOK, formatDecimal, formatDate } from "@/lib/format";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { getSnapshotData, getReportDates } from "@/lib/period";

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
          const unitKey = [
            property.streetName, property.streetNumber,
            u.unitNumber ?? "", u.customNumber ?? "",
          ].join("_").toLowerCase().replace(/\s+/g, "");
          return {
            id: u.id,
            unitNumber: u.unitNumber || u.customNumber || "—",
            unitType: u.unitType,
            areaSqm: toNum(u.areaSqm),
            floor: u.floor,
            status: contract?.status ?? "ledig",
            leaseholderName: contract?.leaseholder?.name ?? null,
            monthlyRent: contract ? toNum(contract.monthlyRent) : 0,
            unitKey,
            companyId: company.id,
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
        unitKey: u.unitKey,
        companyId: u.companyId,
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

  // Compute trends by comparing with the previous report period
  let trends: {
    rent?: { text: string; dir: "up" | "down" | "neutral" };
    area?: { text: string; dir: "up" | "down" | "neutral" };
    walt?: { text: string; dir: "up" | "down" | "neutral" };
    companies?: { text: string; dir: "up" | "down" | "neutral" };
  } = {};

  const reportDates = await getReportDates(accountId);
  if (reportDates.length >= 2) {
    // Find current and previous period
    const currentPeriod = period ?? reportDates[0].toISOString().slice(0, 10);
    const currentIdx = reportDates.findIndex(
      (d) => d.toISOString().slice(0, 10) === currentPeriod
    );
    const prevDate = currentIdx >= 0 && currentIdx < reportDates.length - 1
      ? reportDates[currentIdx + 1]
      : currentIdx === -1 ? reportDates[0] : null;

    if (prevDate) {
      const prevSnapData = await getSnapshotData(accountId, prevDate.toISOString().slice(0, 10));
      const prevData = getDataFromSnapshots(prevSnapData);
      if (prevData) {
        const pctChange = (curr: number, prev: number) => {
          if (prev === 0) return curr > 0 ? 100 : 0;
          return ((curr - prev) / prev) * 100;
        };
        const fmtPct = (pct: number) =>
          `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`;
        const dir = (pct: number): "up" | "down" | "neutral" =>
          pct > 0.5 ? "up" : pct < -0.5 ? "down" : "neutral";

        const rentPct = pctChange(totalAnnualized, prevData.totalAnnualized);
        trends.rent = { text: fmtPct(rentPct), dir: dir(rentPct) };

        const areaPct = pctChange(totalArea, prevData.totalArea);
        trends.area = { text: fmtPct(areaPct), dir: dir(areaPct) };

        const waltDelta = walt - prevData.walt;
        trends.walt = {
          text: `${waltDelta >= 0 ? "+" : ""}${formatDecimal(waltDelta, 1)} år`,
          dir: waltDelta > 0.05 ? "up" : waltDelta < -0.05 ? "down" : "neutral",
        };

        const compDelta = companyCount - prevData.companyCount;
        if (compDelta !== 0) {
          trends.companies = {
            text: `${compDelta >= 0 ? "+" : ""}${compDelta}`,
            dir: compDelta > 0 ? "up" : "down",
          };
        }
      }
    }
  }

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
          trend={trends.rent?.text}
          trendDirection={trends.rent?.dir}
        />
        <KpiCard
          label="Totalt areal"
          value={`${formatNOK(totalArea)} m²`}
          icon={Ruler}
          color="blue"
          trend={trends.area?.text}
          trendDirection={trends.area?.dir}
        />
        <KpiCard
          label="WALT"
          value={formatDecimal(walt, 1) + " år"}
          icon={CalendarClock}
          color="purple"
          trend={trends.walt?.text}
          trendDirection={trends.walt?.dir}
        />
        <KpiCard
          label="Selskaper"
          value={String(companyCount)}
          icon={Building2}
          color="purple"
          trend={trends.companies?.text}
          trendDirection={trends.companies?.dir}
        />
      </div>

      {/* Property list */}
      <PropertyList properties={propertyRows} />

      {/* Vacancy & rent trend + Recent changes — side by side on large screens */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VacancyTrend accountId={accountId} />
        <RecentChanges accountId={accountId} />
      </div>

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

async function VacancyTrend({ accountId }: { accountId: string }) {
  // Aggregate vacancy per report date across all companies
  const rows = await prisma.$queryRaw<
    Array<{
      report_date: Date;
      total_units: bigint;
      vacant_units: bigint;
      total_rent: number;
    }>
  >`
    WITH deduped AS (
      SELECT DISTINCT ON (s.company_id, s.unit_key, s.report_date)
        s.report_date,
        s.status,
        s.monthly_rent::numeric as monthly_rent
      FROM rent_roll_snapshots s
      JOIN companies c ON c.id = s.company_id
      WHERE c.account_id = ${accountId}::uuid
      ORDER BY s.company_id, s.unit_key, s.report_date, s.created_at DESC
    )
    SELECT
      report_date,
      COUNT(*) as total_units,
      COUNT(*) FILTER (WHERE status IS NULL OR status = 'ledig') as vacant_units,
      COALESCE(SUM(monthly_rent), 0)::float as total_rent
    FROM deduped
    GROUP BY report_date
    ORDER BY report_date
  `;

  if (rows.length < 2) return null;

  const data = rows.map((r) => ({
    date: r.report_date,
    total: Number(r.total_units),
    vacant: Number(r.vacant_units),
    occupancyPct: Number(r.total_units) > 0
      ? ((Number(r.total_units) - Number(r.vacant_units)) / Number(r.total_units)) * 100
      : 100,
    rent: r.total_rent,
  }));

  const maxRent = Math.max(...data.map((d) => d.rent), 1);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="p-5 pb-3">
        <h3 className="text-base font-semibold text-gray-900">Utvikling over tid</h3>
      </div>
      <div className="px-5 pb-5">
        {/* Occupancy bars with rent overlay */}
        <div className="flex items-end gap-1" style={{ height: 100 }}>
          {data.map((d, i) => (
            <div key={i} className="group relative flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-t bg-emerald-400"
                style={{ height: `${d.occupancyPct}%` }}
              />
              {d.vacant > 0 && (
                <div
                  className="w-full bg-amber-200"
                  style={{ height: `${100 - d.occupancyPct}%` }}
                />
              )}
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                {formatDate(d.date)}
                <br />
                {d.total - d.vacant}/{d.total} utleid ({d.occupancyPct.toFixed(0)}%)
                <br />
                kr {formatNOK(d.rent * 12)}/år
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>{formatDate(data[0].date)}</span>
          <span>{formatDate(data[data.length - 1].date)}</span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" /> Utleid
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-200" /> Ledig
          </span>
        </div>
      </div>
    </div>
  );
}

const eventIcons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  unit_created: { icon: Plus, color: "text-blue-600", bg: "bg-blue-100" },
  tenant_moved_in: { icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-100" },
  tenant_moved_out: { icon: UserMinus, color: "text-red-600", bg: "bg-red-100" },
  rent_changed: { icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-100" },
  cpi_adjustment: { icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-100" },
  contract_renewed: { icon: RefreshCw, color: "text-purple-600", bg: "bg-purple-100" },
  status_changed: { icon: ArrowUpDown, color: "text-gray-600", bg: "bg-gray-100" },
  security_changed: { icon: Shield, color: "text-cyan-600", bg: "bg-cyan-100" },
};
const defaultEventIcon = { icon: AlertCircle, color: "text-gray-500", bg: "bg-gray-100" };

async function RecentChanges({ accountId }: { accountId: string }) {
  const events = await prisma.unitEvent.findMany({
    where: { company: { accountId } },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      company: { select: { name: true } },
      import: { select: { filename: true } },
    },
  });

  if (events.length === 0) return null;

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="p-5 pb-3">
        <h3 className="text-base font-semibold text-gray-900">Siste endringer</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {events.map((event) => {
          const config = eventIcons[event.eventType] ?? defaultEventIcon;
          const Icon = config.icon;
          return (
            <div key={event.id} className="flex items-start gap-3 px-5 py-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}
              >
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 truncate">
                  <Link
                    href={`/tidslinje/${encodeURIComponent(event.unitKey)}?company=${event.companyId}`}
                    className="hover:underline"
                  >
                    {event.description}
                  </Link>
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{formatDate(event.eventDate)}</span>
                  <span>&middot;</span>
                  <span>{event.company.name}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
