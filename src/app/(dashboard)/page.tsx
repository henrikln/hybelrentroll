export const dynamic = "force-dynamic";

import { Banknote, CalendarClock, Building2, Ruler } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PropertyList } from "@/components/dashboard/property-list";
import { formatNOK, formatDecimal } from "@/lib/format";
import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

async function getData(accountId: string) {
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

  // Sort alphabetically by address
  propertyRows.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const totalAnnualized = propertyRows.reduce(
    (sum, p) => sum + p.annualizedRent,
    0
  );

  // WALT calculation (weighted by rent)
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

  return { companies, propertyRows, totalAnnualized, walt, totalArea };
}

export default async function OversiktPage() {
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

  const { companies, propertyRows, totalAnnualized, walt, totalArea } =
    await getData(accountId);

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
          value={String(companies.length)}
          icon={Building2}
          color="purple"
        />
      </div>

      {/* Property list */}
      <PropertyList properties={propertyRows} />
    </div>
  );
}
