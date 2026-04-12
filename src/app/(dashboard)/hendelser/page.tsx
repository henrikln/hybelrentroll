"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
  UserMinus,
  TrendingUp,
  RefreshCw,
  Shield,
  AlertCircle,
  Plus,
  ArrowUpDown,
} from "lucide-react";

interface UnitEvent {
  unitKey: string;
  eventType: string;
  description: string;
  eventDate?: string;
}

const eventIcons: Record<string, { icon: React.ElementType; color: string }> = {
  tenant_moved_in: { icon: UserPlus, color: "text-emerald-500" },
  tenant_moved_out: { icon: UserMinus, color: "text-red-500" },
  rent_changed: { icon: TrendingUp, color: "text-blue-500" },
  cpi_adjustment: { icon: TrendingUp, color: "text-amber-500" },
  contract_renewed: { icon: RefreshCw, color: "text-purple-500" },
  security_changed: { icon: Shield, color: "text-gray-500" },
  status_changed: { icon: ArrowUpDown, color: "text-orange-500" },
  unit_created: { icon: Plus, color: "text-emerald-500" },
};

// In-memory event store — will be replaced with DB query
const EVENT_STORE_KEY = "hybelrentroll_events";

export default function HendelserPage() {
  const [events, setEvents] = useState<UnitEvent[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(EVENT_STORE_KEY);
      if (stored) setEvents(JSON.parse(stored));
    } catch {}
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Hendelser</h1>

      {events.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">
            Ingen hendelser ennå. Last opp rent roll-filer under Import for å generere hendelser.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm divide-y divide-gray-50">
          {events.map((event, i) => {
            const config = eventIcons[event.eventType] ?? {
              icon: AlertCircle,
              color: "text-gray-400",
            };
            const Icon = config.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-4">
                <div className="mt-0.5">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{event.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {event.eventDate ?? "Nylig"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
