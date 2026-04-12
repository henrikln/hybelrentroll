import { Building, Banknote, Home, Users } from "lucide-react";
import { formatNOK } from "@/lib/format";

// Demo data — will come from DB
const companies = [
  {
    id: "1",
    name: "NAGELGÅRDEN AS",
    orgNumber: "931734385",
    propertyCount: 8,
    unitCount: 14,
    occupiedUnits: 13,
    totalMonthlyRent: 219560,
  },
  {
    id: "2",
    name: "STRANGEHAGEN 18 AS",
    orgNumber: "998604087",
    propertyCount: 1,
    unitCount: 5,
    occupiedUnits: 5,
    totalMonthlyRent: 147091,
  },
];

export default function SelskaperPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Selskaper</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {companies.map((company) => (
          <div
            key={company.id}
            className="rounded-xl bg-white border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Building className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{company.name}</h3>
                <p className="text-xs text-gray-400">{company.orgNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-gray-300" />
                <div>
                  <p className="text-xs text-gray-400">Eiendommer</p>
                  <p className="text-sm font-medium text-gray-900">{company.propertyCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-300" />
                <div>
                  <p className="text-xs text-gray-400">Enheter</p>
                  <p className="text-sm font-medium text-gray-900">
                    {company.occupiedUnits}/{company.unitCount} utleid
                  </p>
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-xs text-gray-400">Månedlig leie</p>
                  <p className="text-sm font-medium text-gray-900">
                    kr {formatNOK(company.totalMonthlyRent)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
