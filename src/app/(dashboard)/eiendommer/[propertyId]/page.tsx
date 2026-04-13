export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { notFound } from "next/navigation";
import { Banknote, Users, Ruler } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TenantTable, type TenantRow } from "@/components/dashboard/tenant-table";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const accountId = await getAccountId();
  if (!accountId) notFound();

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

  if (!property) notFound();

  const totalUnits = property.units.length;
  const vacantUnits = property.units.filter((u) => {
    const c = u.contracts[0];
    return !c || c.status === "ledig";
  }).length;
  const annualRent = property.units.reduce((sum, u) => {
    const c = u.contracts[0];
    return sum + (c ? toNum(c.monthlyRent) * 12 : 0);
  }, 0);
  const totalArea = property.units.reduce(
    (sum, u) => sum + toNum(u.areaSqm),
    0
  );

  const tenants: TenantRow[] = property.units
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
        company: property.company.name,
        areaSqm: toNum(u.areaSqm),
        monthlyRent: toNum(contract.monthlyRent),
      };
    });

  tenants.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const address = `${property.streetName} ${property.streetNumber}`;

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
      </div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">{address}</h1>
      <p className="mb-4 text-sm text-gray-400">
        {property.postalCode} {property.postalPlace}
        {property.gnr > 0 && ` · gnr. ${property.gnr} / bnr. ${property.bnr}`}
        {` · ${property.company.name}`}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/streetview?address=${encodeURIComponent(`${address}, ${property.postalCode} ${property.postalPlace}`)}`}
          alt={address}
          className="h-48 w-full rounded-xl object-cover bg-gray-100"
          loading="lazy"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/staticmap?markers=${encodeURIComponent(`${address}, ${property.postalCode} ${property.postalPlace}, Norway`)}`}
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
