export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { ExpiryChart, type ContractBar } from "./expiry-chart";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

export default async function UtlopsprofilPage() {
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

  const contracts: ContractBar[] = companies.flatMap((company) =>
    company.properties.flatMap((property) =>
      property.units
        .filter((u) => u.contracts[0]?.leaseholder)
        .map((u) => {
          const c = u.contracts[0];
          const lh = c.leaseholder!;
          return {
            id: c.id,
            tenant: lh.name,
            unit: u.unitNumber || u.customNumber || "—",
            address: `${property.streetName} ${property.streetNumber}`,
            company: company.name,
            monthlyRent: toNum(c.monthlyRent),
            startDate: c.startDate?.toISOString().split("T")[0] ?? null,
            endDate: c.endDate?.toISOString().split("T")[0] ?? null,
          };
        })
    )
  );

  contracts.sort((a, b) => {
    if (!a.endDate && !b.endDate) return a.tenant.localeCompare(b.tenant, "nb");
    if (!a.endDate) return 1;
    if (!b.endDate) return -1;
    return a.endDate.localeCompare(b.endDate);
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Utløpsprofil</h1>

      {contracts.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">Ingen aktive kontrakter.</p>
        </div>
      ) : (
        <ExpiryChart contracts={contracts} />
      )}
    </div>
  );
}
