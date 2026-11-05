"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

/** Дата брони по Алматы в формате YYYY-MM-DD */
export function almatyDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(0, 10);
}

/** Сетка месяца: брони по дням, выбранный день, сегодня. Месяц — «YYYY-MM». */
export function BookingCalendar({
  month,
  selectedDay,
  today,
  counts,
  onMonthChange,
  onSelectDay,
}: {
  month: string;
  selectedDay: string;
  today: string;
  counts: Record<string, number>;
  onMonthChange: (month: string) => void;
  onSelectDay: (day: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // понедельник — первый
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onMonthChange(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="rounded-xl bg-bg-secondary p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Прошлый месяц" onClick={() => shift(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-card">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-semibold">
          {MONTHS[m - 1]} {y}
        </p>
        <button type="button" aria-label="Следующий месяц" onClick={() => shift(1)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-card">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 text-text-muted">
            {d}
          </span>
        ))}
        {cells.map((day, i) =>
          day ? (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg text-sm ${
                day === selectedDay ? "bg-cyan text-black" : day === today ? "bg-white/10" : "bg-bg-card hover:bg-white/5"
              }`}
            >
              <span>{Number(day.slice(8))}</span>
              {counts[day] ? (
                <span className={`text-[10px] font-semibold ${day === selectedDay ? "text-black" : "text-amber-300"}`}>
                  {counts[day]} бр.
                </span>
              ) : null}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
