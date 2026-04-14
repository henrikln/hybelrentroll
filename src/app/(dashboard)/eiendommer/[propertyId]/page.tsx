export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { notFound } from "next/navigation";
import { Banknote, Users, Ruler } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TenantTable, type TenantRow } from "@/components/dashboard/tenant-table";
import { UnitTable, type UnitRow } from "@/components/dashboard/unit-table";
import { getSnapshotData, normalizeSnapshots, type SnapshotUnit } from "@/lib/period";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

function calcDurationMonths(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

interface PropertyData {
  address: string;
  postalCode: string;
  postalPlace: string;
  gnr: number | null;
  bnr: number | null;
  companyName: string;
  annualRent: number;
  totalArea: number;
  totalUnits: number;
  vacantUnits: number;
  tenants: TenantRow[];
  units: UnitRow[];
}

async function getLiveData(
  accountId: string,
  propertyId: string
): Promise<PropertyData | null> {
  // Direct UUID lookup — the 3-field unique constraint ensures no duplicates
  const property = await prisma.property.findFirst({
    where: { id: propertyId, company: { accountId } },
    include: {
      company: true,
      units: {
        include: {
          contracts: {
            include: { leaseholder: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!property) return null;

  const first = property;
  const allUnits = property.units;

  const totalUnits = allUnits.length;
  const vacantUnits = allUnits.filter((u) => {
    const c = u.contracts[0];
    return !c || c.status === "ledig";
  }).length;
  const annualRent = allUnits.reduce((sum, u) => {
    const c = u.contracts[0];
    return sum + (c ? toNum(c.monthlyRent) * 12 : 0);
  }, 0);
  const totalArea = allUnits.reduce(
    (sum, u) => sum + toNum(u.areaSqm),
    0
  );

  const tenants: TenantRow[] = allUnits
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
        address: `${first.streetName} ${first.streetNumber}`,
        company: first.company.name,
        areaSqm: toNum(u.areaSqm),
        monthlyRent: toNum(contract.monthlyRent),
      };
    });

  tenants.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const unitRows: UnitRow[] = allUnits.map((u) => {
    const c = u.contracts[0];
    const status: UnitRow["status"] =
      !c || c.status === "ledig" ? "ledig" : c.status === "oppsagt" ? "oppsagt" : "aktiv";
    const rent = c ? toNum(c.monthlyRent) : 0;
    const prevRent = c?.rentBeforeLastAdjustment ? toNum(c.rentBeforeLastAdjustment) : null;

    return {
      id: u.id,
      unitNumber: u.unitNumber || u.customNumber || "—",
      areaSqm: toNum(u.areaSqm),
      status,
      monthlyRent: rent,
      previousRent: prevRent,
      endDate: c?.endDate ? c.endDate.toISOString().slice(0, 10) : null,
      durationMonths: c ? calcDurationMonths(c.startDate, c.endDate) : null,
      lastKnownRent: status === "ledig" ? rent : null,
    };
  });

  return {
    address: `${first.streetName} ${first.streetNumber}`,
    postalCode: first.postalCode,
    postalPlace: first.postalPlace,
    gnr: first.gnr,
    bnr: first.bnr,
    companyName: first.company.name,
    annualRent,
    totalArea,
    totalUnits,
    vacantUnits,
    tenants,
    units: unitRows,
  };
}

function getSnapshotPropertyData(
  units: SnapshotUnit[],
  propertyId: string
): PropertyData | null {
  // propertyId can be a real UUID (live mode) or "companyId_streetName_streetNumber" (snapshot mode)
  // Also supports legacy "streetName_streetNumber" format
  let propertyUnits = units.filter(
    (u) =>
      `${u.companyId}_${u.streetName}_${u.streetNumber}` === propertyId ||
      `${u.streetName}_${u.streetNumber}` === propertyId
  );

  if (propertyUnits.length === 0) return null;

  const first = propertyUnits[0];
  const totalUnits = propertyUnits.length;
  const vacantUnits = propertyUnits.filter(
    (u) => !u.status || u.status === "ledig"
  ).length;
  const annualRent = propertyUnits.reduce(
    (sum, u) => sum + u.monthlyRent * 12,
    0
  );
  const totalArea = propertyUnits.reduce((sum, u) => sum + u.areaSqm, 0);

  const tenants: TenantRow[] = propertyUnits
    .filter((u) => u.leaseholderName && u.status === "aktiv")
    .map((u) => ({
      id: u.id,
      name: u.leaseholderName!,
      email: u.leaseholderEmail,
      unitNumber: u.unitNumber,
      address: `${u.streetName} ${u.streetNumber}`,
      company: u.companyName,
      areaSqm: u.areaSqm,
      monthlyRent: u.monthlyRent,
    }));

  tenants.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const unitRows: UnitRow[] = propertyUnits.map((u) => {
    const status: UnitRow["status"] =
      !u.status || u.status === "ledig" ? "ledig" : u.status === "oppsagt" ? "oppsagt" : "aktiv";
    const startDate = u.startDate ? new Date(u.startDate) : null;
    const endDate = u.endDate ? new Date(u.endDate) : null;

    return {
      id: u.id,
      unitNumber: u.unitNumber,
      areaSqm: u.areaSqm,
      status,
      monthlyRent: u.monthlyRent,
      previousRent: null, // Not available in snapshot data
      endDate: u.endDate ? u.endDate.toISOString().slice(0, 10) : null,
      durationMonths: calcDurationMonths(startDate, endDate),
      lastKnownRent: status === "ledig" ? u.monthlyRent : null,
    };
  });

  return {
    address: `${first.streetName} ${first.streetNumber}`,
    postalCode: first.postalCode,
    postalPlace: first.postalPlace,
    gnr: first.gnr,
    bnr: first.bnr,
    companyName: first.companyName,
    annualRent,
    totalArea,
    totalUnits,
    vacantUnits,
    tenants,
    units: unitRows,
  };
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { propertyId } = await params;
  const { period } = await searchParams;
  const accountId = await getAccountId();
  if (!accountId) notFound();

  let data: PropertyData | null;
  if (period) {
    const snapData = await getSnapshotData(accountId, period);
    if (!snapData) notFound();
    const units = normalizeSnapshots(snapData!);
    data = getSnapshotPropertyData(units, decodeURIComponent(propertyId));
    // If not found by address key, try looking up the property ID to get its address
    if (!data) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, company: { accountId } },
        select: { streetName: true, streetNumber: true, companyId: true },
      });
      if (property) {
        data = getSnapshotPropertyData(
          units,
          `${property.companyId}_${property.streetName}_${property.streetNumber}`
        );
      }
    }
  } else {
    data = await getLiveData(accountId, propertyId);
  }

  if (!data) notFound();

  const {
    address,
    postalCode,
    postalPlace,
    gnr,
    bnr,
    companyName,
    annualRent,
    totalArea,
    totalUnits,
    vacantUnits,
    tenants,
    units,
  } = data;

  return (
    <div>
      <div className="mb-1">
        <Link
          href={`/eiendommer${period ? `?period=${period}` : ""}`}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Eiendommer
        </Link>
        <span className="mx-2 text-gray-300">/</span>
      </div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">{address}</h1>
      <p className="mb-4 text-sm text-gray-400">
        {postalCode} {postalPlace}
        {gnr != null && gnr > 0 && ` · gnr. ${gnr} / bnr. ${bnr}`}
        {` · ${companyName}`}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/streetview?address=${encodeURIComponent(`${address}, ${postalCode} ${postalPlace}`)}`}
          alt={address}
          className="h-48 w-full rounded-xl object-cover bg-gray-100"
          loading="lazy"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/staticmap?markers=${encodeURIComponent(`${address}, ${postalCode} ${postalPlace}, Norway`)}`}
          alt={`Kart over ${address}`}
          className="h-48 w-full rounded-xl object-cover bg-gray-100"
          loading="lazy"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>

      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Boenheter ({units.length})
      </h2>

      {units.length === 0 ? (
        <div className="mb-6 rounded-xl bg-white border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">Ingen boenheter registrert.</p>
        </div>
      ) : (
        <div className="mb-6">
          <UnitTable units={units} />
        </div>
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
