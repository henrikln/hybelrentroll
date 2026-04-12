"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { formatNOK, formatDate } from "@/lib/format";

interface RentRollRow {
  property: {
    streetName: string;
    streetNumber: string;
    postalCode: string;
    postalPlace: string;
    municipality: string | null;
    gnr: number | null;
    bnr: number | null;
  };
  unit: {
    unitNumber: string | null;
    customNumber: string | null;
    unitType: string;
    numRooms: number | null;
    numBedrooms: number | null;
    floor: number | null;
  };
  tenant: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  contract: {
    externalContractId: string | null;
    status: string;
    contractType: string | null;
    startDate: string | null;
    endDate: string | null;
    monthlyRent: number | null;
    noticePeriodMonths: number | null;
  };
  security: {
    securityType: string;
    amount: number | null;
  } | null;
}

// This will come from the DB eventually — for now, demo data from last upload
const DEMO_DATA_KEY = "hybelrentroll_last_import";

export default function RentRollPage() {
  const [rows, setRows] = useState<RentRollRow[]>([]);

  useEffect(() => {
    // TODO: Replace with server-side DB query
    const stored = localStorage.getItem(DEMO_DATA_KEY);
    if (stored) {
      try {
        setRows(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const statusColor: Record<string, string> = {
    aktiv: "bg-emerald-100 text-emerald-700",
    ledig: "bg-red-100 text-red-700",
    oppsagt: "bg-amber-100 text-amber-700",
  };

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Rent roll</h1>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">
            Ingen data ennå. Last opp en rent roll-fil under Import.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Eiendom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Enhet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Leietaker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                    Mnd. leie
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Start
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Slutt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                    Sikkerhet
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.property.streetName} {row.property.streetNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.unit.customNumber ?? row.unit.unitNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {row.unit.unitType}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.tenant?.name ?? (
                        <span className="text-gray-300">Ledig</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColor[row.contract.status] ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {row.contract.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {row.contract.monthlyRent
                        ? `kr ${formatNOK(row.contract.monthlyRent)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(row.contract.startDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(row.contract.endDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.security
                        ? `${row.security.securityType} kr ${formatNOK(row.security.amount ?? 0)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
