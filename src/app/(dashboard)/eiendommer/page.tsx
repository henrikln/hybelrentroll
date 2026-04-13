export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { Building, Users, Banknote, Ruler } from "lucide-react";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

export default async function EiendommerPage() {
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
              contracts: { orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });

  const propertyCards = companies.flatMap((company) =>
    company.properties.map((property) => {
      const totalUnits = property.units.length;
      const vacantUnits = property.units.filter((u) => {
        const contract = u.contracts[0];
        return !contract || contract.status === "ledig";
      }).length;
      const annualRent = property.units.reduce((sum, u) => {
        const contract = u.contracts[0];
        return sum + (contract ? toNum(contract.monthlyRent) * 12 : 0);
      }, 0);
      const totalArea = property.units.reduce(
        (sum, u) => sum + toNum(u.areaSqm),
        0
      );

      return {
        id: property.id,
        name: `${property.streetName} ${property.streetNumber}`,
        postalCode: property.postalCode,
        postalPlace: property.postalPlace,
        gnr: property.gnr,
        bnr: property.bnr,
        company: company.name,
        totalUnits,
        vacantUnits,
        annualRent,
        totalArea,
      };
    })
  );

  propertyCards.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Eiendommer</h1>

      {propertyCards.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <Building className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">
            Ingen eiendommer registrert ennå.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {propertyCards.map((property) => (
            <Link
              key={property.id}
              href={`/eiendommer/${property.id}`}
              className="rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow block overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/streetview?fov=120&address=${encodeURIComponent(`${property.name}, ${property.postalCode} ${property.postalPlace}`)}`}
                alt={property.name}
                className="h-32 w-full object-cover bg-gray-100"
                loading="lazy"
              />
              <div className="p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {property.name}
                </h3>
                <p className="text-xs text-gray-400">
                  {property.postalCode} {property.postalPlace}
                  {property.gnr > 0 &&
                    ` · gnr. ${property.gnr} / bnr. ${property.bnr}`}
                </p>
                <p className="text-xs text-gray-400">{property.company}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-300" />
                  <div>
                    <p className="text-xs text-gray-400">Enheter</p>
                    <p className="text-sm font-medium text-gray-900">
                      {property.vacantUnits > 0
                        ? `${property.totalUnits} (${property.vacantUnits} ledige)`
                        : String(property.totalUnits)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-gray-300" />
                  <div>
                    <p className="text-xs text-gray-400">Areal</p>
                    <p className="text-sm font-medium text-gray-900">
                      {property.totalArea > 0
                        ? `${formatNOK(property.totalArea)} m²`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-xs text-gray-400">Årlig leie</p>
                    <p className="text-sm font-medium text-gray-900">
                      kr {formatNOK(property.annualRent)}
                    </p>
                  </div>
                </div>
              </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
