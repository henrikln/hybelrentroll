export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { ExpiryChart, type ContractBar } from "./expiry-chart";
import { getSnapshotData, normalizeSnapshots } from "@/lib/period";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

async function getLiveContracts(accountId: string): Promise<ContractBar[]> {
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

  return companies.flatMap((company) =>
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
}

function getSnapshotContracts(
  snapData: NonNullable<Awaited<ReturnType<typeof getSnapshotData>>>
): ContractBar[] {
  const units = normalizeSnapshots(snapData);
  return units
    .filter((u) => u.leaseholderName && u.status === "aktiv")
    .map((u) => ({
      id: u.id,
      tenant: u.leaseholderName!,
      unit: u.unitNumber,
      address: `${u.streetName} ${u.streetNumber}`,
      company: u.companyName,
      monthlyRent: u.monthlyRent,
      startDate: u.startDate?.toISOString().split("T")[0] ?? null,
      endDate: u.endDate?.toISOString().split("T")[0] ?? null,
    }));
}

export default async function UtlopsprofilPage({
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

  let contracts: ContractBar[];
  if (period) {
    const snapData = await getSnapshotData(accountId, period);
    if (!snapData) {
      return (
        <div className="p-12 text-center">
          <p className="text-sm text-gray-400">Ingen data for valgt periode.</p>
        </div>
      );
    }
    contracts = getSnapshotContracts(snapData);
  } else {
    contracts = await getLiveContracts(accountId);
  }

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
