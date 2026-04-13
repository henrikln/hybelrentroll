export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { Building2, Home, Users, Banknote, Ruler } from "lucide-react";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

export default async function SelskaperPage() {
  const accountId = await getAccountId();
  if (!accountId) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-400">Ingen data ennå.</p>
      </div>
    );
  }

  const companies = await prisma.company.findMany({
    where: { accountId },
    include: {
      properties: {
        include: {
          units: {
            include: {
              contracts: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const companyCards = companies.map((company) => {
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

    return {
      id: company.id,
      name: company.name,
      orgNumber: company.orgNumber,
      propertyCount: company.properties.length,
      totalUnits,
      vacantUnits,
      annualRent,
      totalArea,
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Selskaper</h1>

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
              href={`/selskaper/${company.id}`}
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
