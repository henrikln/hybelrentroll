export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { notFound } from "next/navigation";
import { Building2, Banknote, Users, Ruler } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TenantTable, type TenantRow } from "@/components/dashboard/tenant-table";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const accountId = await getAccountId();
  if (!accountId) notFound();

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

  if (!company) notFound();

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

  return (
    <div>
      <div className="mb-1">
        <Link
          href="/selskaper"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Selskaper
        </Link>
        <span className="mx-2 text-gray-300">/</span>
      </div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">
        {company.name}
        <span className="ml-2 text-sm font-normal text-gray-400">
          {company.orgNumber}
        </span>
      </h1>

      {company.properties.length > 0 && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/staticmap?markers=${encodeURIComponent(
              company.properties
                .map(
                  (p) =>
                    `${p.streetName} ${p.streetNumber}, ${p.postalCode} ${p.postalPlace}, Norway`
                )
                .join("|")
            )}`}
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
          value={String(company.properties.length)}
          icon={Building2}
          color="purple"
        />
      </div>

      {company.properties.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Eiendommer ({company.properties.length})
          </h2>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {company.properties.map((property) => {
              const addr = `${property.streetName} ${property.streetNumber}`;
              const pUnits = property.units.length;
              const pVacant = property.units.filter((u) => {
                const c = u.contracts[0];
                return !c || c.status === "ledig";
              }).length;
              return (
                <Link
                  key={property.id}
                  href={`/eiendommer/${property.id}`}
                  className="rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow block overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/streetview?address=${encodeURIComponent(`${addr}, ${property.postalCode} ${property.postalPlace}`)}`}
                    alt={addr}
                    className="h-28 w-full object-cover bg-gray-100"
                    loading="lazy"
                  />
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {addr}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {property.postalCode} {property.postalPlace}
                      {property.gnr > 0 &&
                        ` · gnr. ${property.gnr} / bnr. ${property.bnr}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {pVacant > 0
                        ? `${pUnits} enheter (${pVacant} ledige)`
                        : `${pUnits} enheter`}
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
