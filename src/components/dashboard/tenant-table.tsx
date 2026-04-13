"use client";

import { useState } from "react";
import { formatNOK } from "@/lib/format";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface TenantRow {
  id: string;
  name: string;
  email: string | null;
  unitNumber: string;
  address: string;
  company: string;
  areaSqm: number;
  monthlyRent: number;
}

type SortKey = "name" | "unitNumber" | "address" | "company" | "areaSqm" | "monthlyRent";
type SortDir = "asc" | "desc";

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Navn" },
  { key: "unitNumber", label: "Enhet" },
  { key: "address", label: "Adresse" },
  { key: "company", label: "Selskap" },
  { key: "areaSqm", label: "Areal", align: "right" },
  { key: "monthlyRent", label: "Månedlig leie", align: "right" },
];

export function TenantTable({ tenants }: { tenants: TenantRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...tenants].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), "nb");
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium select-none ${col.align === "right" ? "text-right" : ""}`}
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
          {sorted.map((t) => (
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
  );
}
