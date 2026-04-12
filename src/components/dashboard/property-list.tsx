"use client";

import { useState } from "react";
import { Building, Banknote, Maximize, Home, X } from "lucide-react";
import { formatNOKShort, formatNOK, formatArea } from "@/lib/format";

interface UnitInfo {
  id: string;
  unitNumber: string;
  unitType: string;
  areaSqm: number;
  floor: number | null;
  status: string;
  leaseholderName: string | null;
  monthlyRent: number;
}

interface PropertyRow {
  id: string;
  companyName: string;
  name: string;
  annualizedRent: number;
  areaSqm: number;
  totalUnits: number;
  vacantUnits: number;
  units: UnitInfo[];
}

const iconColors = [
  { bg: "bg-purple-100", icon: "text-purple-500" },
  { bg: "bg-emerald-100", icon: "text-emerald-500" },
  { bg: "bg-blue-100", icon: "text-blue-500" },
  { bg: "bg-amber-100", icon: "text-amber-500" },
  { bg: "bg-pink-100", icon: "text-pink-500" },
  { bg: "bg-cyan-100", icon: "text-cyan-500" },
];

export function PropertyList({ properties }: { properties: PropertyRow[] }) {
  const [selected, setSelected] = useState<PropertyRow | null>(null);

  if (properties.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
        <Building className="mx-auto mb-3 h-10 w-10 text-gray-200" />
        <p className="text-sm text-gray-400">
          Ingen eiendommer ennå. Last opp en rent roll for å komme i gang.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
        <div className="p-5 pb-3">
          <h3 className="text-base font-semibold text-gray-900">Eiendommer</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-t border-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Eiendom
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Selskap
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Enheter
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Annualisert
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Areal
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property, idx) => {
              const colors = iconColors[idx % iconColors.length];
              return (
                <tr
                  key={property.id}
                  className="border-t border-gray-50 transition-colors hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(property)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}`}
                      >
                        <Building className={`h-4 w-4 ${colors.icon}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {property.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {property.companyName}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Home className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-gray-700">
                        {property.totalUnits}
                        {property.vacantUnits > 0 && (
                          <span className="text-amber-500">
                            {" "}
                            ({property.vacantUnits} ledige)
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm text-gray-700">
                        {formatNOKShort(property.annualizedRent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Maximize className="h-4 w-4 text-purple-400" />
                      <span className="text-sm text-gray-700">
                        {formatArea(property.areaSqm)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Property detail popup */}
      {selected && (
        <PropertyPopup
          property={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function PropertyPopup({
  property,
  onClose,
}: {
  property: PropertyRow;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="relative mx-4 max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          {property.name}
        </h2>
        <p className="mb-4 text-sm text-gray-400">{property.companyName}</p>

        <div className="mb-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Enheter</p>
            <p className="text-sm font-medium">
              {property.totalUnits}
              {property.vacantUnits > 0 && (
                <span className="text-amber-500">
                  {" "}
                  ({property.vacantUnits} ledige)
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Annualisert leie</p>
            <p className="text-sm font-medium">
              {formatNOK(property.annualizedRent)} kr
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Areal</p>
            <p className="text-sm font-medium">
              {formatArea(property.areaSqm)}
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="pb-2 font-medium">Enhet</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Leietaker</th>
              <th className="pb-2 font-medium">Leie/mnd</th>
              <th className="pb-2 font-medium">Areal</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {property.units.map((unit) => (
              <tr key={unit.id} className="border-b border-gray-50">
                <td className="py-2 font-medium text-gray-900">
                  {unit.unitNumber}
                </td>
                <td className="py-2 text-gray-500">{unit.unitType}</td>
                <td className="py-2 text-gray-700">
                  {unit.leaseholderName ?? (
                    <span className="text-amber-500">Ledig</span>
                  )}
                </td>
                <td className="py-2 text-gray-700">
                  {unit.monthlyRent > 0
                    ? formatNOK(unit.monthlyRent) + " kr"
                    : "—"}
                </td>
                <td className="py-2 text-gray-500">
                  {unit.areaSqm > 0 ? formatArea(unit.areaSqm) : "—"}
                </td>
                <td className="py-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      unit.status === "aktiv"
                        ? "bg-emerald-50 text-emerald-600"
                        : unit.status === "oppsagt"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {unit.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
