export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { notFound } from "next/navigation";
import { Building2, Banknote, Users, Ruler } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TenantTable, type TenantRow } from "@/components/dashboard/tenant-table";
import { getSnapshotData, normalizeSnapshots, type SnapshotUnit } from "@/lib/period";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

interface PropertyRow {
  id: string;
  address: string;
  postalCode: string;
  postalPlace: string;
  gnr: number | null;
  bnr: number | null;
  unitCount: number;
  vacantCount: number;
}

interface CompanyData {
  name: string;
  orgNumber: string;
  annualRent: number;
  totalArea: number;
  totalUnits: number;
  vacantUnits: number;
  properties: PropertyRow[];
  tenants: TenantRow[];
  mapMarkers: string;
}

async function getLiveData(
  accountId: string,
  companyId: string
): Promise<CompanyData | null> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, accountId },
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

  if (!company) return null;

  const allUnits = company.properties.flatMap((p) => p.units);
  const totalUnits = allUnits.length;
  const vacantUnits = allUnits.filter((u) => {
    const c = u.contracts[0];
    return !c || c.status === "ledig";
  }).length;
  const annualRent = allUnits.reduce((sum, u) => {
    const c = u.contracts[0];
    return sum + (c ? toNum(c.monthlyRent) * 12 : 0);
  }, 0);
  const totalArea = allUnits.reduce((sum, u) => sum + toNum(u.areaSqm), 0);

  // Group by address to merge duplicate Property records
  const propGroupMap = new Map<string, {
    address: string;
    postalCode: string;
    postalPlace: string;
    gnr: number | null;
    bnr: number | null;
    unitCount: number;
    vacantCount: number;
  }>();

  for (const p of company.properties) {
    const addr = `${p.streetName} ${p.streetNumber}`;
    if (!propGroupMap.has(addr)) {
      propGroupMap.set(addr, {
        address: addr,
        postalCode: p.postalCode,
        postalPlace: p.postalPlace,
        gnr: p.gnr,
        bnr: p.bnr,
        unitCount: 0,
        vacantCount: 0,
      });
    }
    const group = propGroupMap.get(addr)!;
    group.unitCount += p.units.length;
    group.vacantCount += p.units.filter((u) => {
      const c = u.contracts[0];
      return !c || c.status === "ledig";
    }).length;
  }

  const properties: PropertyRow[] = [...propGroupMap.entries()].map(([addr, g]) => ({
    id: addr,
    ...g,
  }));

  const tenants: TenantRow[] = company.properties.flatMap((property) =>
    property.units
      .filter((u) => {
        const c = u.contracts[0];
        return c?.leaseholder && c.status === "aktiv";
      })
      .map((u) => {
        const contract = u.contracts[0];
        const lh = contract.leaseholder!;
        return {
          id: lh.id + u.id,
          name: lh.name,
          email: lh.email || null,
          unitNumber: u.unitNumber || u.customNumber || "—",
          address: `${property.streetName} ${property.streetNumber}`,
          company: company.name,
          areaSqm: toNum(u.areaSqm),
          monthlyRent: toNum(contract.monthlyRent),
        };
      })
  );

  tenants.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const mapMarkers = [...propGroupMap.values()]
    .map((g) => `${g.address}, ${g.postalCode} ${g.postalPlace}, Norway`)
    .join("|");

  return {
    name: company.name,
    orgNumber: company.orgNumber,
    annualRent,
    totalArea,
    totalUnits,
    vacantUnits,
    properties,
    tenants,
    mapMarkers,
  };
}

function getSnapshotCompanyData(
  units: SnapshotUnit[],
  companyId: string
): CompanyData | null {
  const companyUnits = units.filter((u) => u.companyId === companyId);
  if (companyUnits.length === 0) return null;

  const first = companyUnits[0];
  const totalUnits = companyUnits.length;
  const vacantUnits = companyUnits.filter(
    (u) => !u.status || u.status === "ledig"
  ).length;
  const annualRent = companyUnits.reduce(
    (sum, u) => sum + u.monthlyRent * 12,
    0
  );
  const totalArea = companyUnits.reduce((sum, u) => sum + u.areaSqm, 0);

  // Group by property address
  const propMap = new Map<
    string,
    { first: SnapshotUnit; units: SnapshotUnit[] }
  >();
  for (const u of companyUnits) {
    const addr = `${u.streetName} ${u.streetNumber}`;
    if (!propMap.has(addr)) {
      propMap.set(addr, { first: u, units: [] });
    }
    propMap.get(addr)!.units.push(u);
  }

  const properties: PropertyRow[] = [...propMap.values()].map((p) => ({
    id: `${p.first.streetName}_${p.first.streetNumber}`,
    address: `${p.first.streetName} ${p.first.streetNumber}`,
    postalCode: p.first.postalCode,
    postalPlace: p.first.postalPlace,
    gnr: p.first.gnr,
    bnr: p.first.bnr,
    unitCount: p.units.length,
    vacantCount: p.units.filter((u) => !u.status || u.status === "ledig")
      .length,
  }));

  const tenants: TenantRow[] = companyUnits
    .filter((u) => u.leaseholderName && u.status === "aktiv")
    .map((u) => ({
      id: u.id,
      name: u.leaseholderName!,
      email: u.leaseholderEmail,
      unitNumber: u.unitNumber,
      address: `${u.streetName} ${u.streetNumber}`,
      company: first.companyName,
      areaSqm: u.areaSqm,
      monthlyRent: u.monthlyRent,
    }));

  tenants.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const mapMarkers = [...propMap.values()]
    .map(
      (p) =>
        `${p.first.streetName} ${p.first.streetNumber}, ${p.first.postalCode} ${p.first.postalPlace}, Norway`
    )
    .join("|");

  return {
    name: first.companyName,
    orgNumber: first.companyOrgNumber,
    annualRent,
    totalArea,
    totalUnits,
    vacantUnits,
    properties,
    tenants,
    mapMarkers,
  };
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId } = await params;
  const { period } = await searchParams;
  const accountId = await getAccountId();
  if (!accountId) notFound();

  let data: CompanyData | null;
  if (period) {
    const snapData = await getSnapshotData(accountId, period);
    if (!snapData) notFound();
    const units = normalizeSnapshots(snapData!);
    data = getSnapshotCompanyData(units, companyId);
  } else {
    data = await getLiveData(accountId, companyId);
  }

  if (!data) notFound();

  const {
    name,
    orgNumber,
    annualRent,
    totalArea,
    totalUnits,
    vacantUnits,
    properties,
    tenants,
    mapMarkers,
  } = data;

  return (
    <div>
      <div className="mb-1">
        <Link
          href={`/selskaper${period ? `?period=${period}` : ""}`}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Selskaper
        </Link>
        <span className="mx-2 text-gray-300">/</span>
      </div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">
        {name}
        <span className="ml-2 text-sm font-normal text-gray-400">
          {orgNumber}
        </span>
      </h1>

      {mapMarkers && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/staticmap?markers=${encodeURIComponent(mapMarkers)}`}
            alt="Kart over eiendommer"
            className="mb-6 h-48 w-full rounded-xl object-cover bg-gray-100"
            loading="lazy"
          />
        </>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Årlig leie"
          value={`kr ${formatNOK(annualRent)}`}
          icon={Banknote}
          color="green"
        />
        <KpiCard
          label="Totalt areal"
          value={totalArea > 0 ? `${formatNOK(totalArea)} m²` : "—"}
          icon={Ruler}
          color="blue"
        />
        <KpiCard
          label="Enheter"
          value={
            vacantUnits > 0
              ? `${totalUnits} (${vacantUnits} ledige)`
              : String(totalUnits)
          }
          icon={Users}
          color="purple"
        />
        <KpiCard
          label="Eiendommer"
          value={String(properties.length)}
          icon={Building2}
          color="purple"
        />
      </div>

      {properties.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Eiendommer ({properties.length})
          </h2>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((prop) => {
              const href = period
                ? `/eiendommer/${encodeURIComponent(prop.id)}?period=${period}`
                : `/eiendommer/${prop.id}`;
              return (
                <Link
                  key={prop.id}
                  href={href}
                  className="rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow block overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/streetview?address=${encodeURIComponent(`${prop.address}, ${prop.postalCode} ${prop.postalPlace}`)}`}
                    alt={prop.address}
                    className="h-28 w-full object-cover bg-gray-100"
                    loading="lazy"
                  />
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {prop.address}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {prop.postalCode} {prop.postalPlace}
                      {prop.gnr != null &&
                        prop.gnr > 0 &&
                        ` · gnr. ${prop.gnr} / bnr. ${prop.bnr}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {prop.vacantCount > 0
                        ? `${prop.unitCount} enheter (${prop.vacantCount} ledige)`
                        : `${prop.unitCount} enheter`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Leietakere ({tenants.length})
      </h2>

      {tenants.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">Ingen aktive leietakere.</p>
        </div>
      ) : (
        <TenantTable tenants={tenants} />
      )}
    </div>
  );
}
