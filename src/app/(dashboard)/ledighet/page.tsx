export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK, formatDate } from "@/lib/format";
import { KeyRound } from "lucide-react";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

export default async function LedighetPage() {
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
                include: { leaseholder: true },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  const vacantUnits = companies.flatMap((company) =>
    company.properties.flatMap((property) =>
      property.units
        .filter((u) => {
          const contract = u.contracts[0];
          return !contract || contract.status === "ledig";
        })
        .map((u) => {
          const contract = u.contracts[0];
          return {
            id: u.id,
            company: company.name,
            address: `${property.streetName} ${property.streetNumber}`,
            unitNumber: u.unitNumber || u.customNumber || "—",
            unitType: u.unitType,
            areaSqm: toNum(u.areaSqm),
            floor: u.floor,
            lastRent: contract ? toNum(contract.monthlyRent) * 12 : null,
            vacantSince: contract?.endDate ?? null,
          };
        })
    )
  );

  vacantUnits.sort((a, b) => a.address.localeCompare(b.address, "nb"));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Ledighet</h1>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
          {vacantUnits.length} ledige enheter
        </span>
      </div>

      {vacantUnits.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <KeyRound className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">
            Ingen ledige enheter - alt er utleid!
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3 font-medium">Enhet</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Selskap</th>
                <th className="px-4 py-3 font-medium text-right">Areal</th>
                <th className="px-4 py-3 font-medium">Etasje</th>
                <th className="px-4 py-3 font-medium text-right">
                  Siste årsleie
                </th>
                <th className="px-4 py-3 font-medium">Ledig fra</th>
              </tr>
            </thead>
            <tbody>
              {vacantUnits.map((unit) => (
                <tr
                  key={unit.id}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {unit.address}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{unit.unitNumber}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {unit.unitType}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{unit.company}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {unit.areaSqm > 0 ? `${formatNOK(unit.areaSqm)} m²` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {unit.floor ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {unit.lastRent
                      ? `kr ${formatNOK(unit.lastRent)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {unit.vacantSince
                      ? formatDate(unit.vacantSince)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
