export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { FileSpreadsheet } from "lucide-react";
import { ImportUploader } from "./import-uploader";

export default async function ImportPage() {
  const accountId = await getAccountId();

  const imports = accountId
    ? await prisma.rentRollImport.findMany({
        where: { accountId },
        include: {
          company: { select: { name: true } },
          snapshots: {
            select: { reportDate: true },
            distinct: ["reportDate" as const],
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const rows = imports.map((imp) => ({
    id: imp.id,
    filename: imp.filename,
    company: imp.company?.name ?? "—",
    reportDate: imp.snapshots[0]?.reportDate
      ? imp.snapshots[0].reportDate.toLocaleDateString("nb-NO")
      : "—",
    status: imp.status,
    rowsImported: imp.rowsImported,
    rowsTotal: imp.rowsTotal,
    source: imp.source,
    createdAt: imp.createdAt.toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Import</h1>

      <ImportUploader />

      {/* Import history */}
      <div className="mt-6 rounded-xl bg-white border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">
            Importhistorikk
          </h3>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">Ingen importer ennå</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-5 py-3 font-medium">Rapportdato</th>
                <th className="px-5 py-3 font-medium">Selskap</th>
                <th className="px-5 py-3 font-medium">Filnavn</th>
                <th className="px-5 py-3 font-medium">Rader</th>
                <th className="px-5 py-3 font-medium">Kilde</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Importert</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {row.reportDate}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{row.company}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">
                    {row.filename}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {row.rowsImported ?? "—"} / {row.rowsTotal ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.source === "email"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.source === "email" ? "E-post" : "Opplasting"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === "completed"
                          ? "bg-green-50 text-green-700"
                          : row.status === "failed"
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {row.status === "completed"
                        ? "Fullført"
                        : row.status === "failed"
                          ? "Feilet"
                          : "Behandler"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{row.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
