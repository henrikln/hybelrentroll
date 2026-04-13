export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { Building, Users, Banknote, Ruler } from "lucide-react";
import { getSnapshotData, normalizeSnapshots } from "@/lib/period";
import Link from "next/link";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

interface PropertyCard {
  id: string;
  name: string;
  postalCode: string;
  postalPlace: string;
  gnr: number | null;
  bnr: number | null;
  company: string;
  totalUnits: number;
  vacantUnits: number;
  annualRent: number;
  totalArea: number;
}

async function getLiveData(accountId: string): Promise<PropertyCard[]> {
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

  // Group by company + address to merge duplicate Property records
  const groupMap = new Map<string, {
    company: string;
    name: string;
    postalCode: string;
    postalPlace: string;
    gnr: number | null;
    bnr: number | null;
    units: { monthlyRent: number; areaSqm: number; status: string }[];
  }>();

  for (const company of companies) {
    for (const property of company.properties) {
      const addr = `${property.streetName} ${property.streetNumber}`;
      const key = `${company.id}_${addr}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          company: company.name,
          name: addr,
          postalCode: property.postalCode,
          postalPlace: property.postalPlace,
          gnr: property.gnr,
          bnr: property.bnr,
          units: [],
        });
      }

      const group = groupMap.get(key)!;
      for (const u of property.units) {
        const contract = u.contracts[0];
        group.units.push({
          monthlyRent: contract ? toNum(contract.monthlyRent) : 0,
          areaSqm: toNum(u.areaSqm),
          status: contract?.status ?? "ledig",
        });
      }
    }
  }

  return [...groupMap.entries()].map(([key, group]) => ({
    id: key,
    name: group.name,
    postalCode: group.postalCode,
    postalPlace: group.postalPlace,
    gnr: group.gnr,
    bnr: group.bnr,
    company: group.company,
    totalUnits: group.units.length,
    vacantUnits: group.units.filter((u) => u.status === "ledig").length,
    annualRent: group.units.reduce((sum, u) => sum + u.monthlyRent * 12, 0),
    totalArea: group.units.reduce((sum, u) => sum + u.areaSqm, 0),
  }));
}

function getSnapshotCards(
  snapData: NonNullable<Awaited<ReturnType<typeof getSnapshotData>>>
): PropertyCard[] {
  const units = normalizeSnapshots(snapData);
  const propertyMap = new Map<
    string,
    { units: typeof units; first: (typeof units)[0] }
  >();

  for (const u of units) {
    // Group by company + address to match live view behavior
    const key = `${u.companyId}_${u.streetName}_${u.streetNumber}`;
    if (!propertyMap.has(key)) {
      propertyMap.set(key, { units: [], first: u });
    }
    propertyMap.get(key)!.units.push(u);
  }

  return [...propertyMap.values()].map((prop) => {
    const f = prop.first;
    return {
      id: `${f.companyId}_${f.streetName}_${f.streetNumber}`,
      name: `${f.streetName} ${f.streetNumber}`,
      postalCode: f.postalCode,
      postalPlace: f.postalPlace,
      gnr: f.gnr,
      bnr: f.bnr,
      company: f.companyName,
      totalUnits: prop.units.length,
      vacantUnits: prop.units.filter((u) => !u.status || u.status === "ledig").length,
      annualRent: prop.units.reduce((sum, u) => sum + u.monthlyRent * 12, 0),
      totalArea: prop.units.reduce((sum, u) => sum + u.areaSqm, 0),
    };
  });
}

export default async function EiendommerPage({
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

  let propertyCards: PropertyCard[];
  if (period) {
    const snapData = await getSnapshotData(accountId, period);
    if (!snapData) {
      return (
        <div className="p-12 text-center">
          <p className="text-sm text-gray-400">Ingen data for valgt periode.</p>
        </div>
      );
    }
    propertyCards = getSnapshotCards(snapData);
  } else {
    propertyCards = await getLiveData(accountId);
  }

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
          {propertyCards.map((property) => {
            const href = period
              ? `/eiendommer/${encodeURIComponent(property.id)}?period=${period}`
              : `/eiendommer/${property.id}`;
            return (
              <Link
                key={property.id}
                href={href}
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
                    {property.gnr != null &&
                      property.gnr > 0 &&
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
            );
          })}
        </div>
      )}
    </div>
  );
}
