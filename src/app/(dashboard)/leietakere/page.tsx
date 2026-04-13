export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { formatNOK } from "@/lib/format";
import { Users } from "lucide-react";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

export default async function LeietakerePage() {
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
                where: { status: "aktiv" },
                include: { leaseholder: true },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  const tenants = companies.flatMap((company) =>
    company.properties.flatMap((property) =>
      property.units
        .filter((u) => {
          const contract = u.contracts[0];
          return contract?.leaseholder;
        })
        .map((u) => {
          const contract = u.contracts[0];
          const lh = contract.leaseholder!;
          return {
            id: lh.id + u.id,
            name: lh.name,
            email: lh.email || null,
            phone: lh.phone || null,
            address: `${property.streetName} ${property.streetNumber}`,
            unitNumber: u.unitNumber || u.customNumber || "—",
            company: company.name,
            areaSqm: toNum(u.areaSqm),
            monthlyRent: toNum(contract.monthlyRent),
          };
        })
    )
  );

  tenants.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Leietakere</h1>
        <span className="rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
          {tenants.length} leietakere
        </span>
      </div>

      {tenants.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">
            Ingen leietakere registrert ennå.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Navn</th>
                <th className="px-4 py-3 font-medium">Enhet</th>
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3 font-medium">Selskap</th>
                <th className="px-4 py-3 font-medium text-right">Areal</th>
                <th className="px-4 py-3 font-medium text-right">
                  Månedlig leie
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    {t.email && (
                      <p className="text-xs text-gray-400">{t.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.unitNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{t.address}</td>
                  <td className="px-4 py-3 text-gray-400">{t.company}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {t.areaSqm > 0 ? `${formatNOK(t.areaSqm)} m²` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">
                    kr {formatNOK(t.monthlyRent)}
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
