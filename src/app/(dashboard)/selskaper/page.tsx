export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { Building2, Home, Users, Banknote, Ruler } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { getSnapshotData, normalizeSnapshots } from "@/lib/period";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

interface CompanyCard {
  id: string;
  name: string;
  orgNumber: string;
  propertyCount: number;
  totalUnits: number;
  vacantUnits: number;
  annualRent: number;
  totalArea: number;
}

async function getLiveData(accountId: string): Promise<CompanyCard[]> {
  const companies = await prisma.company.findMany({
    where: { accountId },
    include: {
      properties: {
        include: {
          units: {
            include: {
              contracts: { orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return companies.map((company) => {
    const allUnits = company.properties.flatMap((p) => p.units);
    const totalUnits = allUnits.length;
    const vacantUnits = allUnits.filter((u) => {
      const contract = u.contracts[0];
      return !contract || contract.status === "ledig";
    }).length;
    const annualRent = allUnits.reduce((sum, u) => {
      const contract = u.contracts[0];
      return sum + (contract ? toNum(contract.monthlyRent) * 12 : 0);
    }, 0);
    const totalArea = allUnits.reduce((sum, u) => sum + toNum(u.areaSqm), 0);

    // Count unique addresses (not DB records — duplicates can exist)
    const uniqueAddresses = new Set(
      company.properties.map((p) => `${p.streetName} ${p.streetNumber}`)
    );

    return {
      id: company.id,
      name: company.name,
      orgNumber: company.orgNumber,
      propertyCount: uniqueAddresses.size,
      totalUnits,
      vacantUnits,
      annualRent,
      totalArea,
    };
  });
}

function getSnapshotCards(
  snapData: NonNullable<Awaited<ReturnType<typeof getSnapshotData>>>
): CompanyCard[] {
  const units = normalizeSnapshots(snapData);
  const companyMap = new Map<
    string,
    { id: string; name: string; orgNumber: string; addresses: Set<string>; units: typeof units }
  >();

  for (const u of units) {
    if (!companyMap.has(u.companyId)) {
      companyMap.set(u.companyId, {
        id: u.companyId,
        name: u.companyName,
        orgNumber: u.companyOrgNumber,
        addresses: new Set(),
        units: [],
      });
    }
    const entry = companyMap.get(u.companyId)!;
    entry.addresses.add(`${u.streetName} ${u.streetNumber}`);
    entry.units.push(u);
  }

  return [...companyMap.values()].map((c) => ({
    id: c.id,
    name: c.name,
    orgNumber: c.orgNumber,
    propertyCount: c.addresses.size,
    totalUnits: c.units.length,
    vacantUnits: c.units.filter((u) => !u.status || u.status === "ledig").length,
    annualRent: c.units.reduce((sum, u) => sum + u.monthlyRent * 12, 0),
    totalArea: c.units.reduce((sum, u) => sum + u.areaSqm, 0),
  }));
}

export default async function SelskaperPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const accountId = await getAccountId();
  if (!accountId) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-400">Ingen data ennå.</p>
      </div>
    );
  }

  const { period } = await searchParams;

  let companyCards: CompanyCard[];
  if (period) {
    const snapData = await getSnapshotData(accountId, period);
    if (!snapData) {
      return (
        <div className="p-12 text-center">
          <p className="text-sm text-gray-400">Ingen data for valgt periode.</p>
        </div>
      );
    }
    companyCards = getSnapshotCards(snapData);
  } else {
    companyCards = await getLiveData(accountId);
  }

  companyCards.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const totalAnnualRent = companyCards.reduce((s, c) => s + c.annualRent, 0);
  const totalAreaAll = companyCards.reduce((s, c) => s + c.totalArea, 0);
  const totalUnitsAll = companyCards.reduce((s, c) => s + c.totalUnits, 0);
  const totalVacantAll = companyCards.reduce((s, c) => s + c.vacantUnits, 0);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Selskaper</h1>

      {companyCards.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Annualisert leie"
            value={`kr ${formatNOK(totalAnnualRent)}`}
            icon={Banknote}
            color="green"
          />
          <KpiCard
            label="Totalt areal"
            value={`${formatNOK(totalAreaAll)} m²`}
            icon={Ruler}
            color="blue"
          />
          <KpiCard
            label="Enheter"
            value={totalVacantAll > 0 ? `${totalUnitsAll} (${totalVacantAll} ledige)` : String(totalUnitsAll)}
            icon={Users}
            color="purple"
          />
          <KpiCard
            label="Selskaper"
            value={String(companyCards.length)}
            icon={Building2}
            color="purple"
          />
        </div>
      )}

      {companyCards.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">Ingen selskaper registrert ennå.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {companyCards.map((company) => (
            <Link
              key={company.id}
              href={`/selskaper/${company.id}${period ? `?period=${period}` : ""}`}
              className="rounded-xl bg-white border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Building2 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {company.name}
                  </h3>
                  <p className="text-xs text-gray-400">{company.orgNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Stat
                  icon={Home}
                  label="Eiendommer"
                  value={String(company.propertyCount)}
                />
                <Stat
                  icon={Users}
                  label="Enheter"
                  value={
                    company.vacantUnits > 0
                      ? `${company.totalUnits} (${company.vacantUnits} ledige)`
                      : String(company.totalUnits)
                  }
                />
                <Stat
                  icon={Banknote}
                  label="Årlig leie"
                  value={`kr ${formatNOK(company.annualRent)}`}
                  color="emerald"
                />
                <Stat
                  icon={Ruler}
                  label="Totalt areal"
                  value={
                    company.totalArea > 0
                      ? `${formatNOK(company.totalArea)} m²`
                      : "—"
                  }
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color = "gray",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  const iconColor =
    color === "emerald" ? "text-emerald-400" : "text-gray-300";
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
