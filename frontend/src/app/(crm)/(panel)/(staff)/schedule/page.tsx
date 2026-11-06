"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { readApiUserError } from "@/lib/api-error-message";
import { almatyToday } from "@/lib/almaty";

type Shift = {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  arrivedAt: string | null;
  leftAt: string | null;
  lateMinutes: number;
};

type MonthRow = {
  userId: string;
  name: string;
  shifts: number;
  plannedHours: number;
  workedHours: number;
  lates: number;
  lateMinutes: number;
  missed: number;
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function mondayOf(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
}

function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** ISO → YYYY-MM-DD по Алматы */
function almatyDay(iso: string) {
  return new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(0, 10);
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit" });
}

export default function SchedulePage() {
  const { selectedVenueId } = useCrmVenue();
  const { user } = useAuth();
  const role = user?.role?.toUpperCase();
  const isAdmin = role === "ADMIN";
  const canPlan = isAdmin || role === "MANAGER";
  const today = almatyToday();

  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [totals, setTotals] = useState<MonthRow[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: "", day: "", start: "12:00", end: "22:00" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const loadWeek = useCallback(() => {
    if (!selectedVenueId || !canPlan) return;
    api
      .get("/team/week", { params: { venueId: selectedVenueId, weekStart } })
      .then(({ data }) => {
        setEmployees(data.employees ?? []);
        setShifts(data.shifts ?? []);
      })
      .catch((e) => setError(readApiUserError(e, "График не загрузился")));
  }, [selectedVenueId, weekStart, canPlan]);

  const loadMonth = useCallback(() => {
    if (!selectedVenueId || !canPlan) return;
    api
      .get("/team/month", { params: { venueId: selectedVenueId, month } })
      .then(({ data }) => setTotals(Array.isArray(data) ? data : []))
      .catch(() => setTotals([]));
  }, [selectedVenueId, month, canPlan]);

  const loadMine = useCallback(() => {
    api
      .get("/schedule/me")
      .then(({ data }) => setMine(Array.isArray(data) ? data : []))
      .catch(() => setMine([]));
  }, []);

  useEffect(() => loadWeek(), [loadWeek]);
  useEffect(() => loadMonth(), [loadMonth]);
  useEffect(() => loadMine(), [loadMine]);

  const cell = (userId: string, day: string) => shifts.filter((s) => s.userId === userId && almatyDay(s.startsAt) === day);

  // В сетке — все сотрудники точки и те, у кого есть смены (если сотрудника отвязали от точки)
  const gridPeople = useMemo(() => {
    const known = new Map(employees.map((e) => [e.id, e.name]));
    for (const s of shifts) if (!known.has(s.userId)) known.set(s.userId, "—");
    return [...known.entries()].map(([id, name]) => ({ id, name }));
  }, [employees, shifts]);

  async function add() {
    setError("");
    setOk("");
    if (!form.userId || !form.day || !form.start || !form.end) {
      setError("Выберите сотрудника, день, начало и конец");
      return;
    }
    try {
      await api.post("/schedule", {
        venueId: selectedVenueId,
        userId: form.userId,
        startsAt: `${form.day}T${form.start}`,
        endsAt: `${form.day}T${form.end}`,
      });
      setForm({ ...form, day: "" });
      setOk("Смена поставлена");
      loadWeek();
      loadMonth();
    } catch (e) {
      setError(readApiUserError(e, "Не удалось поставить смену"));
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Убрать эту смену из графика?")) return;
    try {
      await api.delete(`/team/schedule/${id}`);
      loadWeek();
      loadMonth();
    } catch (e) {
      setError(readApiUserError(e, "Не удалось убрать смену"));
    }
  }

  async function copyWeek() {
    setError("");
    setOk("");
    try {
      const { data } = await api.post("/team/week/copy", { venueId: selectedVenueId, weekStart });
      setOk(data.copied ? `Скопировано смен: ${data.copied}` : "Нечего копировать: прошлая неделя пуста или уже перенесена");
      loadWeek();
      loadMonth();
    } catch (e) {
      setError(readApiUserError(e, "Не удалось скопировать"));
    }
  }

  async function arrive(id: string) {
    await api.post(`/schedule/${id}/arrive`).catch(() => undefined);
    loadMine();
  }

  const weekLabel = `${new Date(`${days[0]}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" })} – ${new Date(
    `${days[6]}T12:00:00Z`,
  ).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" })}`;

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">График смен</h1>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}

      {mine.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Мои смены</h2>
          {mine.map((row) => (
            <article key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-secondary p-3 text-sm">
              <span>
                {new Date(row.startsAt).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty", weekday: "short", day: "numeric", month: "short" })}{" "}
                {hhmm(row.startsAt)}–{hhmm(row.endsAt)} ·{" "}
                {row.arrivedAt ? `пришёл ${hhmm(row.arrivedAt)}` : "ещё не отмечен"}
              </span>
              {!row.arrivedAt ? (
                <button type="button" onClick={() => void arrive(row.id)} className="min-h-10 rounded-lg bg-bg-card px-3">
                  Я на месте
                </button>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {canPlan ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-label="Прошлая неделя" onClick={() => setWeekStart(addDays(weekStart, -7))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-secondary">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[9rem] text-center font-semibold">{weekLabel}</span>
              <button type="button" aria-label="Следующая неделя" onClick={() => setWeekStart(addDays(weekStart, 7))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-secondary">
                <ChevronRight className="h-4 w-4" />
              </button>
              {weekStart !== mondayOf(today) ? (
                <button type="button" onClick={() => setWeekStart(mondayOf(today))} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm">
                  Эта неделя
                </button>
              ) : null}
              {isAdmin ? (
                <button type="button" onClick={() => void copyWeek()} className="ml-auto min-h-11 rounded-xl bg-bg-secondary px-3 text-sm">
                  Копировать прошлую неделю
                </button>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl bg-bg-secondary">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="p-2">Сотрудник</th>
                    {days.map((d, i) => (
                      <th key={d} className={`p-2 ${d === today ? "text-cyan" : ""}`}>
                        {WEEKDAYS[i]} {Number(d.slice(8))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridPeople.map((p) => (
                    <tr key={p.id} className="border-t border-white/10 align-top">
                      <td className="p-2 font-medium">{p.name}</td>
                      {days.map((d) => (
                        <td key={d} className="p-1">
                          {cell(p.id, d).map((s) => (
                            <div
                              key={s.id}
                              className={`mb-1 flex items-center justify-between gap-1 rounded-lg px-2 py-1 ${
                                s.lateMinutes ? "bg-red-500/20 text-red-300" : s.arrivedAt ? "bg-success/15" : "bg-bg-card"
                              }`}
                              title={s.arrivedAt ? `Пришёл ${hhmm(s.arrivedAt)}${s.lateMinutes ? `, опоздание ${s.lateMinutes} мин` : ""}` : "Нет отметки"}
                            >
                              <span className="tabular-nums">
                                {hhmm(s.startsAt)}–{hhmm(s.endsAt)}
                              </span>
                              {isAdmin && !s.arrivedAt ? (
                                <button type="button" aria-label="Убрать смену" onClick={() => void remove(s.id)} className="text-text-secondary hover:text-text-primary">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {isAdmin && cell(p.id, d).length === 0 ? (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, userId: p.id, day: d })}
                              className="h-8 w-full rounded-lg text-text-muted hover:bg-white/5"
                              aria-label={`Поставить смену ${p.name} на ${d}`}
                            >
                              +
                            </button>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted">Красным — опоздание больше 10 минут, зелёным — пришёл вовремя. {isAdmin ? "«+» подставляет сотрудника и день в форму ниже." : ""}</p>
          </section>

          {isAdmin ? (
          <section className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-4">
            <label className="text-sm md:col-span-2">
              Сотрудник
              <select
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3"
              >
                <option value="">Выберите из списка</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              День
              <input
                type="date"
                value={form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value })}
                className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                Начало
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3" />
              </label>
              <label className="text-sm">
                Конец
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3" />
              </label>
            </div>
            <button type="button" onClick={() => void add()} className="min-h-12 rounded-xl bg-cyan font-semibold text-black md:col-span-4">
              Поставить смену
            </button>
          </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Итоги месяца</h2>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value || today.slice(0, 7))} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm" />
            </div>
            {totals.length === 0 ? (
              <p className="text-sm text-text-secondary">Смен в этом месяце нет</p>
            ) : (
              <div className="overflow-x-auto rounded-xl bg-bg-secondary">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary">
                      <th className="p-2">Сотрудник</th>
                      <th className="p-2">Смен</th>
                      <th className="p-2">Часов по графику</th>
                      <th className="p-2">Отработано</th>
                      <th className="p-2">Опозданий</th>
                      <th className="p-2">Не пришёл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((t) => (
                      <tr key={t.userId} className="border-t border-white/10">
                        <td className="p-2 font-medium">{t.name}</td>
                        <td className="p-2 tabular-nums">{t.shifts}</td>
                        <td className="p-2 tabular-nums">{t.plannedHours}</td>
                        <td className="p-2 tabular-nums">{t.workedHours}</td>
                        <td className={`p-2 tabular-nums ${t.lates ? "text-red-400" : ""}`}>
                          {t.lates}
                          {t.lates ? ` (${t.lateMinutes} мин)` : ""}
                        </td>
                        <td className={`p-2 tabular-nums ${t.missed ? "text-amber-300" : ""}`}>{t.missed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
