import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  color: "green" | "blue" | "purple" | "amber";
}

const colorMap = {
  green: {
    bg: "bg-emerald-100",
    icon: "text-emerald-600",
  },
  blue: {
    bg: "bg-blue-100",
    icon: "text-blue-600",
  },
  purple: {
    bg: "bg-purple-100",
    icon: "text-purple-600",
  },
  amber: {
    bg: "bg-amber-100",
    icon: "text-amber-600",
  },
};

export function KpiCard({ label, value, unit, icon: Icon, color }: KpiCardProps) {
  const colors = colorMap[color];

  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          colors.bg
        )}
      >
        <Icon className={cn("h-6 w-6", colors.icon)} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">
          {value}
          {unit && <span className="ml-1 text-base font-normal text-gray-400">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
