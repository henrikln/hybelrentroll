"use client";

import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

const WEEKDAYS = ["M", "T", "O", "T", "F", "L", "S"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const days: { date: number; currentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ date: prevMonthLastDay - i, currentMonth: false });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: d, currentMonth: true });
  }

  // Next month padding to fill 6 rows
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: d, currentMonth: false });
  }

  return days;
}

const MONTHS_NO = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

interface EventsCalendarProps {
  inboxCount?: number;
}

export function EventsCalendar({ inboxCount = 0 }: EventsCalendarProps) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const days = getCalendarDays(year, month);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Hendelser</h3>
        <span className="text-sm text-gray-400">
          {MONTHS_NO[month]} {year}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day, i) => (
          <div key={i} className="py-1 text-xs font-medium text-gray-400">
            {day}
          </div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm mx-auto",
              !day.currentMonth && "text-gray-300",
              day.currentMonth && "text-gray-700",
              day.currentMonth &&
                day.date === todayDate &&
                "font-bold text-purple-600"
            )}
          >
            {day.date}
          </div>
        ))}
      </div>

      {inboxCount > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-gray-100 pt-4">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Innboks</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-500 px-1.5 text-xs font-medium text-white">
            {inboxCount}
          </span>
        </div>
      )}
    </div>
  );
}
