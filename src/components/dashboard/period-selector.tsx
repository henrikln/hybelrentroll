"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";

export function PeriodSelector({ periods }: { periods: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("period");

  if (periods.length === 0) return null;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "latest") {
      params.delete("period");
    } else {
      params.set("period", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-gray-400" />
      <select
        value={current ?? "latest"}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 rounded-md border border-gray-200 bg-white px-2 pr-7 text-xs text-gray-700 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
      >
        <option value="latest">
          Siste rapport
          {periods.length > 0 &&
            ` (${new Date(periods[0]).toLocaleDateString("nb-NO", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })})`}
        </option>
        {periods.map((p) => (
          <option key={p} value={p}>
            {new Date(p).toLocaleDateString("nb-NO", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </option>
        ))}
      </select>
    </div>
  );
}
