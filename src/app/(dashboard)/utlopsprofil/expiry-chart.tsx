"use client";

import { useMemo } from "react";
import { formatNOK } from "@/lib/format";

export interface ContractBar {
  id: string;
  tenant: string;
  unit: string;
  address: string;
  company: string;
  monthlyRent: number;
  startDate: string | null;
  endDate: string | null;
}

const ROW_HEIGHT = 36;
const LABEL_WIDTH = 280;
const TODAY_COLOR = "#ef4444";
const BAR_COLOR = "#8b5cf6";
const BAR_OPEN_COLOR = "#d4d4d8";
const EXPIRY_COLOR = "#ef4444";

function monthsDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("nb-NO", { month: "short", year: "2-digit" });
}

export function ExpiryChart({ contracts }: { contracts: ContractBar[] }) {
  const today = useMemo(() => new Date(), []);

  const { timelineStart, timelineEnd, months } = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    // Find latest end date, default to 5 years from now
    let maxEnd = new Date(today.getFullYear() + 3, today.getMonth(), 1);
    for (const c of contracts) {
      if (c.endDate) {
        const d = new Date(c.endDate);
        if (d > maxEnd) maxEnd = d;
      }
    }
    const end = new Date(maxEnd.getFullYear(), maxEnd.getMonth() + 2, 1);
    const totalMonths = monthsDiff(start, end);
    const ms: Date[] = [];
    for (let i = 0; i <= totalMonths; i++) {
      ms.push(new Date(start.getFullYear(), start.getMonth() + i, 1));
    }
    return { timelineStart: start, timelineEnd: end, months: ms };
  }, [contracts, today]);

  const totalMonths = monthsDiff(timelineStart, timelineEnd);
  const chartWidth = Math.max(totalMonths * 60, 600);
  const totalHeight = contracts.length * ROW_HEIGHT + 40;

  function dateToX(date: Date): number {
    const m = monthsDiff(timelineStart, date) + date.getDate() / 30;
    return (m / totalMonths) * chartWidth;
  }

  const todayX = dateToX(today);

  // Group months by year for header
  const years = useMemo(() => {
    const yrs: { year: number; startIdx: number; count: number }[] = [];
    for (let i = 0; i < months.length; i++) {
      const y = months[i].getFullYear();
      if (yrs.length === 0 || yrs[yrs.length - 1].year !== y) {
        yrs.push({ year: y, startIdx: i, count: 1 });
      } else {
        yrs[yrs.length - 1].count++;
      }
    }
    return yrs;
  }, [months]);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: LABEL_WIDTH + chartWidth }}>
          {/* Labels column */}
          <div
            className="flex-shrink-0 border-r border-gray-100 bg-gray-50"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Header spacer */}
            <div className="h-10 border-b border-gray-100 px-3 flex items-end">
              <span className="text-xs font-medium text-gray-400 pb-1">Leietaker</span>
            </div>
            {contracts.map((c) => (
              <div
                key={c.id}
                className="flex items-center px-3 border-b border-gray-50"
                style={{ height: ROW_HEIGHT }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {c.tenant}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {c.unit} · {c.address}
                  </p>
                </div>
                <span className="ml-2 flex-shrink-0 text-[10px] text-gray-400">
                  kr {formatNOK(c.monthlyRent * 12)}
                </span>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="flex-1 relative" style={{ width: chartWidth }}>
            <svg width={chartWidth} height={totalHeight} className="block">
              {/* Year headers */}
              {years.map((yr) => {
                const x1 = dateToX(months[yr.startIdx]);
                const x2 =
                  yr.startIdx + yr.count < months.length
                    ? dateToX(months[yr.startIdx + yr.count])
                    : chartWidth;
                return (
                  <g key={yr.year}>
                    <text
                      x={x1 + 4}
                      y={12}
                      className="fill-gray-400"
                      fontSize={10}
                      fontWeight={600}
                    >
                      {yr.year}
                    </text>
                    <line
                      x1={x1}
                      y1={0}
                      x2={x1}
                      y2={totalHeight}
                      stroke="#e5e7eb"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {/* Month grid lines + labels */}
              {months.map((m, i) => {
                const x = dateToX(m);
                const isJan = m.getMonth() === 0;
                return (
                  <g key={i}>
                    {!isJan && (
                      <line
                        x1={x}
                        y1={20}
                        x2={x}
                        y2={totalHeight}
                        stroke="#f3f4f6"
                        strokeWidth={1}
                      />
                    )}
                    <text
                      x={x + 4}
                      y={34}
                      className="fill-gray-300"
                      fontSize={9}
                    >
                      {formatMonth(m)}
                    </text>
                  </g>
                );
              })}

              {/* Today line */}
              <line
                x1={todayX}
                y1={0}
                x2={todayX}
                y2={totalHeight}
                stroke={TODAY_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4,3"
              />
              <text
                x={todayX + 4}
                y={34}
                fill={TODAY_COLOR}
                fontSize={9}
                fontWeight={600}
              >
                I dag
              </text>

              {/* Bars */}
              {contracts.map((c, i) => {
                const y = 40 + i * ROW_HEIGHT + 6;
                const barHeight = ROW_HEIGHT - 12;
                const hasEnd = !!c.endDate;
                const start = c.startDate
                  ? new Date(c.startDate)
                  : timelineStart;
                const end = hasEnd
                  ? new Date(c.endDate!)
                  : timelineEnd;

                const barStart = start < timelineStart ? 0 : dateToX(start);
                const barEnd = end > timelineEnd ? chartWidth : dateToX(end);
                const barWidth = Math.max(barEnd - barStart, 2);

                // Is expiring within 12 months?
                const monthsToExpiry = hasEnd
                  ? monthsDiff(today, new Date(c.endDate!))
                  : Infinity;
                const isExpiringSoon = monthsToExpiry >= 0 && monthsToExpiry <= 12;

                return (
                  <g key={c.id}>
                    {/* Row background on hover */}
                    <rect
                      x={0}
                      y={40 + i * ROW_HEIGHT}
                      width={chartWidth}
                      height={ROW_HEIGHT}
                      fill="transparent"
                      className="hover:fill-gray-50/50"
                    />
                    {/* Bar */}
                    <rect
                      x={barStart}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill={hasEnd ? BAR_COLOR : BAR_OPEN_COLOR}
                      opacity={hasEnd ? 0.8 : 0.4}
                    />
                    {/* Expiry marker */}
                    {hasEnd && (
                      <>
                        <rect
                          x={barEnd - 3}
                          y={y}
                          width={3}
                          height={barHeight}
                          rx={0}
                          fill={isExpiringSoon ? EXPIRY_COLOR : BAR_COLOR}
                        />
                        <text
                          x={barEnd + 5}
                          y={y + barHeight / 2 + 3}
                          fontSize={9}
                          fill={isExpiringSoon ? EXPIRY_COLOR : "#9ca3af"}
                          fontWeight={isExpiringSoon ? 600 : 400}
                        >
                          {new Date(c.endDate!).toLocaleDateString("nb-NO", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
                        </text>
                      </>
                    )}
                    {!hasEnd && (
                      <text
                        x={barEnd - 50}
                        y={y + barHeight / 2 + 3}
                        fontSize={9}
                        fill="#9ca3af"
                      >
                        Løpende
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 border-t border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm" style={{ background: BAR_COLOR, opacity: 0.8 }} />
          <span className="text-[10px] text-gray-400">Tidsbestemt kontrakt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm" style={{ background: BAR_OPEN_COLOR, opacity: 0.4 }} />
          <span className="text-[10px] text-gray-400">Løpende kontrakt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5" style={{ background: TODAY_COLOR }} />
          <span className="text-[10px] text-gray-400">I dag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-1 rounded-sm" style={{ background: EXPIRY_COLOR }} />
          <span className="text-[10px] text-gray-400">Utløp innen 12 mnd</span>
        </div>
      </div>
    </div>
  );
}
