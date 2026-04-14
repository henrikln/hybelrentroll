export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK, formatDate } from "@/lib/format";
import { notFound } from "next/navigation";
import {
  UserPlus,
  UserMinus,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Shield,
  Plus,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

const eventConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  unit_created: { icon: Plus, color: "text-blue-600", bg: "bg-blue-100" },
  tenant_moved_in: { icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-100" },
  tenant_moved_out: { icon: UserMinus, color: "text-red-600", bg: "bg-red-100" },
  rent_changed: { icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-100" },
  cpi_adjustment: { icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-100" },
  contract_renewed: { icon: RefreshCw, color: "text-purple-600", bg: "bg-purple-100" },
  status_changed: { icon: ArrowUpDown, color: "text-gray-600", bg: "bg-gray-100" },
  security_changed: { icon: Shield, color: "text-cyan-600", bg: "bg-cyan-100" },
};

const defaultConfig = { icon: AlertCircle, color: "text-gray-500", bg: "bg-gray-100" };

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ unitKey: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const { unitKey: rawUnitKey } = await params;
  const { company: companyId } = await searchParams;
  const accountId = await getAccountId();
  if (!accountId || !companyId) notFound();

  const unitKey = decodeURIComponent(rawUnitKey);

  // Verify company belongs to account
  const company = await prisma.company.findFirst({
    where: { id: companyId, accountId },
    select: { id: true, name: true },
  });
  if (!company) notFound();

  // Fetch events for this unit
  const events = await prisma.unitEvent.findMany({
    where: { companyId, unitKey },
    orderBy: { eventDate: "desc" },
    include: { import: { select: { filename: true } } },
  });

  // Fetch rent history from snapshots
  const rentHistory = await prisma.$queryRaw<
    Array<{
      report_date: Date;
      monthly_rent: number | null;
      status: string;
      leaseholder_name: string | null;
    }>
  >`
    SELECT DISTINCT ON (s.report_date)
      s.report_date,
      s.monthly_rent::numeric as monthly_rent,
      s.status,
      s.leaseholder_name
    FROM rent_roll_snapshots s
    WHERE s.company_id = ${companyId}::uuid
      AND s.unit_key = ${unitKey}
    ORDER BY s.report_date, s.created_at DESC
  `;

  // Latest snapshot for header info
  const latestSnap = await prisma.rentRollSnapshot.findFirst({
    where: { companyId, unitKey },
    orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
  });

  if (!latestSnap) notFound();

  const address = `${latestSnap.streetName} ${latestSnap.streetNumber}`;
  const unitLabel =
    latestSnap.unitNumber || latestSnap.customNumber || unitKey;

  return (
    <div>
      <div className="mb-1">
        <Link
          href="/eiendommer"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Eiendommer
        </Link>
        <span className="mx-2 text-gray-300">/</span>
        <span className="text-sm text-gray-400">{address}</span>
        <span className="mx-2 text-gray-300">/</span>
      </div>

      <h1 className="mb-1 text-xl font-semibold text-gray-900">
        Enhet {unitLabel}
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        {address} &middot; {company.name}
        {latestSnap.leaseholderName && (
          <> &middot; {latestSnap.leaseholderName}</>
        )}
      </p>

      {/* Current status cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard
          label="Status"
          value={latestSnap.status}
          highlight={latestSnap.status === "ledig" ? "amber" : "emerald"}
        />
        <StatusCard
          label="Husleie/mnd"
          value={
            toNum(latestSnap.monthlyRent) > 0
              ? `kr ${formatNOK(toNum(latestSnap.monthlyRent))}`
              : "—"
          }
        />
        <StatusCard
          label="Areal"
          value={
            toNum(latestSnap.areaSqm) > 0
              ? `${toNum(latestSnap.areaSqm)} m²`
              : "—"
          }
        />
        <StatusCard
          label="Leietaker"
          value={latestSnap.leaseholderName ?? "Ledig"}
          highlight={latestSnap.leaseholderName ? undefined : "amber"}
        />
      </div>

      {/* Rent history chart (simple bar visualization) */}
      {rentHistory.length > 1 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Husleiehistorikk
          </h2>
          <RentChart data={rentHistory} />
        </div>
      )}

      {/* Event timeline */}
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Hendelser ({events.length})
      </h2>

      {events.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">
            Ingen hendelser registrert for denne enheten.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-200" />

            <div className="space-y-6">
              {events.map((event) => {
                const config =
                  eventConfig[event.eventType] ?? defaultConfig;
                const Icon = config.icon;

                return (
                  <div key={event.id} className="relative flex gap-4">
                    <div
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm text-gray-900">
                        {event.description}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span>
                          {formatDate(event.eventDate)}
                        </span>
                        <span>{event.import.filename}</span>
                      </div>
                      <EventDetails event={event} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "emerald" | "amber";
}) {
  const valueColor = highlight === "emerald"
    ? "text-emerald-600"
    : highlight === "amber"
      ? "text-amber-600"
      : "text-gray-900";

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium ${valueColor}`}>{value}</p>
    </div>
  );
}

function RentChart({
  data,
}: {
  data: Array<{
    report_date: Date;
    monthly_rent: number | null;
    status: string;
    leaseholder_name: string | null;
  }>;
}) {
  const sorted = [...data].sort(
    (a, b) => a.report_date.getTime() - b.report_date.getTime()
  );
  const maxRent = Math.max(...sorted.map((d) => d.monthly_rent ?? 0), 1);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {sorted.map((d, i) => {
          const rent = d.monthly_rent ?? 0;
          const pct = (rent / maxRent) * 100;
          const isVacant = d.status === "ledig";

          return (
            <div
              key={i}
              className="group relative flex-1 flex flex-col items-center"
            >
              <div
                className={`w-full rounded-t ${isVacant ? "bg-amber-200" : "bg-emerald-400"}`}
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                {formatDate(d.report_date)}
                <br />
                {isVacant
                  ? "Ledig"
                  : `kr ${formatNOK(rent)}/mnd`}
                {d.leaseholder_name && (
                  <>
                    <br />
                    {d.leaseholder_name}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-400">
        <span>{formatDate(sorted[0].report_date)}</span>
        <span>
          {formatDate(sorted[sorted.length - 1].report_date)}
        </span>
      </div>
    </div>
  );
}

function EventDetails({
  event,
}: {
  event: {
    eventType: string;
    oldValue: unknown;
    newValue: unknown;
  };
}) {
  const old = event.oldValue as Record<string, unknown> | null;
  const next = event.newValue as Record<string, unknown> | null;

  if (!old && !next) return null;

  const changes: Array<{ label: string; from?: string; to?: string }> = [];

  if (event.eventType === "rent_changed" || event.eventType === "cpi_adjustment") {
    if (old?.monthlyRent !== undefined || next?.monthlyRent !== undefined) {
      changes.push({
        label: "Husleie",
        from: old?.monthlyRent != null ? `kr ${formatNOK(Number(old.monthlyRent))}` : undefined,
        to: next?.monthlyRent != null ? `kr ${formatNOK(Number(next.monthlyRent))}` : undefined,
      });
    }
  }

  if (event.eventType === "tenant_moved_in" || event.eventType === "tenant_moved_out") {
    if (old?.leaseholder || next?.leaseholder) {
      changes.push({
        label: "Leietaker",
        from: old?.leaseholder as string | undefined,
        to: next?.leaseholder as string | undefined,
      });
    }
  }

  if (event.eventType === "contract_renewed") {
    if (old?.endDate || next?.endDate) {
      changes.push({
        label: "Utløpsdato",
        from: old?.endDate as string | undefined,
        to: next?.endDate as string | undefined,
      });
    }
  }

  if (changes.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {changes.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">{c.label}:</span>
          {c.from && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600 line-through">
              {c.from}
            </span>
          )}
          {c.from && c.to && <span className="text-gray-300">→</span>}
          {c.to && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-600">
              {c.to}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
