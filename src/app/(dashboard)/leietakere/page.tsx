export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { Users } from "lucide-react";
import { TenantTable } from "@/components/dashboard/tenant-table";
import { getSnapshotData, normalizeSnapshots } from "@/lib/period";

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

interface TenantRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
  unitNumber: string;
  company: string;
  areaSqm: number;
  monthlyRent: number;
}

async function getLiveTenants(accountId: string): Promise<TenantRow[]> {
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
}

function getSnapshotTenants(
  snapData: NonNullable<Awaited<ReturnType<typeof getSnapshotData>>>
): TenantRow[] {
  const units = normalizeSnapshots(snapData);
  return units
    .filter((u) => u.leaseholderName && u.status === "aktiv")
    .map((u) => ({
      id: u.id,
      name: u.leaseholderName!,
      email: u.leaseholderEmail,
      phone: u.leaseholderPhone,
      address: `${u.streetName} ${u.streetNumber}`,
      unitNumber: u.unitNumber,
      company: u.companyName,
      areaSqm: u.areaSqm,
      monthlyRent: u.monthlyRent,
    }));
}

export default async function LeietakerePage({
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

  let tenants: TenantRow[];
  if (period) {
    const snapData = await getSnapshotData(accountId, period);
    if (!snapData) {
      return (
        <div className="p-12 text-center">
          <p className="text-sm text-gray-400">Ingen data for valgt periode.</p>
        </div>
      );
    }
    tenants = getSnapshotTenants(snapData);
  } else {
    tenants = await getLiveTenants(accountId);
  }

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
        <TenantTable tenants={tenants} />
      )}
    </div>
  );
}
