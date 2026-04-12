import { Banknote, CalendarClock, BarChart3, Maximize } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PropertyTable } from "@/components/dashboard/property-table";
import { EventsCalendar } from "@/components/dashboard/events-calendar";
import { formatNOK, formatDecimal } from "@/lib/format";

// Demo data — will be replaced with DB queries
const kpis = {
  annualizedRent: 2399556, // sum of monthly_rent * 12 for active contracts
  rentThisYear: 1999630,
  walt: 1.6,
  leasedArea: 0, // No area data in current file
};

const demoProperties = [
  {
    id: "1",
    name: "Bekketomten 1",
    annualizedRent: 228984,
    rentThisYear: 190820,
    areaSqm: 0,
    colorIndex: 0,
  },
  {
    id: "2",
    name: "Nagelgården 6",
    annualizedRent: 410868,
    rentThisYear: 342390,
    areaSqm: 0,
    colorIndex: 1,
  },
  {
    id: "3",
    name: "Nagelgården 4",
    annualizedRent: 240000,
    rentThisYear: 200000,
    areaSqm: 0,
    colorIndex: 2,
  },
  {
    id: "4",
    name: "Sliberget 3",
    annualizedRent: 224400,
    rentThisYear: 187000,
    areaSqm: 0,
    colorIndex: 3,
  },
  {
    id: "5",
    name: "Tvedtegården 1",
    annualizedRent: 594096,
    rentThisYear: 495080,
    areaSqm: 0,
    colorIndex: 4,
  },
  {
    id: "6",
    name: "Hellandsgården 3",
    annualizedRent: 346476,
    rentThisYear: 288730,
    areaSqm: 0,
    colorIndex: 5,
  },
  {
    id: "7",
    name: "Hellandsgården 1",
    annualizedRent: 234000,
    rentThisYear: 195000,
    areaSqm: 0,
    colorIndex: 0,
  },
  {
    id: "8",
    name: "Bekketomten 2",
    annualizedRent: 356496,
    rentThisYear: 297080,
    areaSqm: 0,
    colorIndex: 1,
  },
];

export default function OversiktPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Oversikt</h1>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Annualisert leie"
          value={formatNOK(kpis.annualizedRent)}
          icon={Banknote}
          color="green"
        />
        <KpiCard
          label="Leie i år"
          value={formatNOK(kpis.rentThisYear)}
          icon={Banknote}
          color="green"
        />
        <KpiCard
          label="WALT"
          value={formatDecimal(kpis.walt)}
          icon={CalendarClock}
          color="blue"
        />
        <KpiCard
          label="Utleid areal"
          value={kpis.leasedArea > 0 ? formatNOK(kpis.leasedArea) : "—"}
          unit={kpis.leasedArea > 0 ? "m²" : undefined}
          icon={Maximize}
          color="purple"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PropertyTable properties={demoProperties} />
        </div>
        <div>
          <EventsCalendar inboxCount={4} />
        </div>
      </div>
    </div>
  );
}
