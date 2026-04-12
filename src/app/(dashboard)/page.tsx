import { Banknote, CalendarClock, BarChart3, Maximize, Building2 } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PropertyTable } from "@/components/dashboard/property-table";
import { EventsCalendar } from "@/components/dashboard/events-calendar";
import { formatNOK, formatDecimal } from "@/lib/format";

// Demo data — will be replaced with DB queries across all companies in the account
const companies = [
  {
    name: "NAGELGÅRDEN AS",
    orgNumber: "931734385",
    totalMonthlyRent: 219560,
    properties: [
      { id: "1", name: "Bekketomten 1", annualizedRent: 228984, areaSqm: 0, colorIndex: 0 },
      { id: "2", name: "Nagelgården 6", annualizedRent: 410868, areaSqm: 0, colorIndex: 1 },
      { id: "3", name: "Nagelgården 4", annualizedRent: 240000, areaSqm: 0, colorIndex: 2 },
      { id: "4", name: "Sliberget 3", annualizedRent: 224400, areaSqm: 0, colorIndex: 3 },
      { id: "5", name: "Tvedtegården 1", annualizedRent: 594096, areaSqm: 0, colorIndex: 4 },
      { id: "6", name: "Hellandsgården 3", annualizedRent: 346476, areaSqm: 0, colorIndex: 5 },
      { id: "7", name: "Hellandsgården 1", annualizedRent: 234000, areaSqm: 0, colorIndex: 0 },
      { id: "8", name: "Bekketomten 2", annualizedRent: 356496, areaSqm: 0, colorIndex: 1 },
    ],
  },
  {
    name: "STRANGEHAGEN 18 AS",
    orgNumber: "998604087",
    totalMonthlyRent: 147091,
    properties: [
      { id: "9", name: "Strangehagen 18", annualizedRent: 1765092, areaSqm: 0, colorIndex: 2 },
    ],
  },
];

const allProperties = companies.flatMap((c) => c.properties);
const totalAnnualized = allProperties.reduce((sum, p) => sum + p.annualizedRent, 0);
export default function OversiktPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Oversikt</h1>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Annualisert leie"
          value={formatNOK(totalAnnualized)}
          icon={Banknote}
          color="green"
        />
        <KpiCard
          label="WALT"
          value={formatDecimal(1.8)}
          icon={CalendarClock}
          color="blue"
        />
        <KpiCard
          label="Selskaper"
          value={String(companies.length)}
          icon={Building2}
          color="purple"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Per-company property tables */}
          {companies.map((company) => (
            <div key={company.orgNumber}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{company.name}</span>
                <span className="text-xs text-gray-400">({company.orgNumber})</span>
              </div>
              <PropertyTable properties={company.properties} />
            </div>
          ))}
        </div>
        <div>
          <EventsCalendar inboxCount={4} />
        </div>
      </div>
    </div>
  );
}
