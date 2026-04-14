"use client";

import { useState } from "react";
import { formatNOK, formatDate } from "@/lib/format";
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";

export interface UnitRow {
  id: string;
  unitNumber: string;
  areaSqm: number;
  status: "aktiv" | "ledig" | "oppsagt";
  monthlyRent: number;
  /** Previous rent before last adjustment — used for trend arrow */
  previousRent: number | null;
  endDate: string | null;
  durationMonths: number | null;
  /** For vacant units: last known rent */
  lastKnownRent: number | null;
}

type SortKey =
  | "unitNumber"
  | "areaSqm"
  | "status"
  | "monthlyRent"
  | "endDate"
  | "durationMonths";
type SortDir = "asc" | "desc";

const statusConfig = {
  aktiv: { label: "Utleid", bg: "bg-emerald-50", text: "text-emerald-700" },
  ledig: { label: "Ledig", bg: "bg-amber-50", text: "text-amber-700" },
  oppsagt: { label: "Oppsagt", bg: "bg-red-50", text: "text-red-700" },
};

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "unitNumber", label: "Enhet" },
  { key: "areaSqm", label: "Areal", align: "right" },
  { key: "status", label: "Status" },
  { key: "monthlyRent", label: "Månedlig leie", align: "right" },
  { key: "endDate", label: "Utløpsdato" },
  { key: "durationMonths", label: "Varighet", align: "right" },
];

function monthsUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date();
  const diff =
    (end.getFullYear() - now.getFullYear()) * 12 +
    (end.getMonth() - now.getMonth());
  return diff;
}

export function UnitTable({ units }: { units: UnitRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("unitNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...units].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    // nulls last
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), "nb");
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium select-none cursor-pointer hover:text-gray-600 ${col.align === "right" ? "text-right" : ""}`}
                onClick={() => handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : (
                    <span className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((u) => {
            const cfg = statusConfig[u.status] ?? statusConfig.ledig;
            const monthsLeft = monthsUntil(u.endDate);
            const expiringSoon =
              monthsLeft !== null && monthsLeft >= 0 && monthsLeft < 3;
            const rentUp =
              u.previousRent !== null && u.monthlyRent > u.previousRent;
            const rentDown =
              u.previousRent !== null && u.monthlyRent < u.previousRent;
            const isVacant = u.status === "ledig";

            return (
              <tr
                key={u.id}
                className="border-b border-gray-50 last:border-0"
              >
                {/* Enhet */}
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.unitNumber}
                </td>

                {/* Areal */}
                <td className="px-4 py-3 text-right text-gray-600">
                  {u.areaSqm > 0 ? `${formatNOK(u.areaSqm)} m²` : "—"}
                </td>

                {/* Status badge */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
                  >
                    {cfg.label}
                  </span>
                </td>

                {/* Månedlig leie med trendpil */}
                <td className="px-4 py-3 text-right">
                  {isVacant ? (
                    u.lastKnownRent && u.lastKnownRent > 0 ? (
                      <span
                        className="italic text-gray-400"
                        title="Siste kjente leie"
                      >
                        kr {formatNOK(u.lastKnownRent)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-gray-900">
                      kr {formatNOK(u.monthlyRent)}
                      {rentUp && (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {rentDown && (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </span>
                  )}
                </td>

                {/* Utløpsdato */}
                <td
                  className={`px-4 py-3 ${expiringSoon ? "font-medium text-red-600" : "text-gray-600"}`}
                >
                  {u.endDate ? formatDate(u.endDate) : "—"}
                </td>

                {/* Varighet */}
                <td className="px-4 py-3 text-right text-gray-600">
                  {u.durationMonths !== null ? `${u.durationMonths} mnd` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
