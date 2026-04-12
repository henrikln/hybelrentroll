import { Building, Banknote, Maximize } from "lucide-react";
import { formatNOKShort, formatArea } from "@/lib/format";

interface PropertyRow {
  id: string;
  name: string;
  annualizedRent: number;
  rentThisYear: number;
  areaSqm: number;
  colorIndex: number;
}

const iconColors = [
  { bg: "bg-purple-100", icon: "text-purple-500" },
  { bg: "bg-emerald-100", icon: "text-emerald-500" },
  { bg: "bg-blue-100", icon: "text-blue-500" },
  { bg: "bg-amber-100", icon: "text-amber-500" },
  { bg: "bg-pink-100", icon: "text-pink-500" },
  { bg: "bg-cyan-100", icon: "text-cyan-500" },
];

interface PropertyTableProps {
  properties: PropertyRow[];
}

export function PropertyTable({ properties }: PropertyTableProps) {
  return (
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
              Annualisert
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              I år
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              Areal
            </th>
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => {
            const colors = iconColors[property.colorIndex % iconColors.length];
            return (
              <tr
                key={property.id}
                className="border-t border-gray-50 transition-colors hover:bg-gray-50"
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
                    <Banknote className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-gray-700">
                      {formatNOKShort(property.rentThisYear)}
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
  );
}
