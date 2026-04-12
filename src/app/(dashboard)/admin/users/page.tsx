export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { Users } from "lucide-react";

export default async function BrukerePage() {
  const accounts = await prisma.account.findMany({
    include: {
      allowedSenders: { orderBy: { createdAt: "asc" } },
      companies: { select: { id: true, name: true } },
      _count: { select: { companies: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">
        Brukere og kontoer
      </h1>

      {accounts.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">Ingen kontoer registrert ennå</p>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {account.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {account._count.companies} selskap
                    {account._count.companies !== 1 ? "er" : ""} ·{" "}
                    Opprettet{" "}
                    {account.createdAt.toLocaleDateString("nb-NO")}
                  </p>
                </div>
              </div>

              {/* Senders / users */}
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-gray-400">
                  Brukere (tillatte avsendere)
                </p>
                <div className="flex flex-wrap gap-2">
                  {account.allowedSenders.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                    >
                      {s.email}
                    </span>
                  ))}
                </div>
              </div>

              {/* Companies */}
              {account.companies.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-400">
                    Selskaper
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {account.companies.map((c) => (
                      <span
                        key={c.id}
                        className="rounded-full bg-purple-50 px-3 py-1 text-xs text-purple-700"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
