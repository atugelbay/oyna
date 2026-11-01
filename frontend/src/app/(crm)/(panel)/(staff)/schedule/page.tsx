"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { settingsService } from "@/services/settings.service";
import { useCrmVenue } from "@/lib/venue-context";

type Employee = { id: string; name?: string; nickname?: string; phone?: string };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SchedulePage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ userId: "", day: "", start: "12:00", end: "22:00" });
  const [error, setError] = useState("");

  function load() {
    if (!selectedVenueId) return;
    api
      .get("/schedule", { params: { venueId: selectedVenueId } })
      .then(({ data }) => setRows(data))
      .catch((e) => setError(e?.response?.data?.message || "График видит владелец"));
    api.get("/schedule/me").then(({ data }) => setMine(data)).catch(() => setMine([]));
    settingsService
      .getEmployees(selectedVenueId)
      .then((data) => setEmployees(Array.isArray(data) ? data : data?.data ?? []))
      .catch(() => setEmployees([]));
  }

  useEffect(() => {
    load();
  }, [selectedVenueId]);

  const weekGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of rows) {
      const key = new Date(row.startsAt).toLocaleDateString("ru-RU", {
        timeZone: "Asia/Almaty",
        weekday: "long",
        day: "numeric",
        month: "short",
      });
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  const monthLate = useMemo(() => {
    return rows.filter((row) => {
      if (!row.arrivedAt) return false;
      return new Date(row.arrivedAt).getTime() - new Date(row.startsAt).getTime() > 10 * 60 * 1000;
    }).length;
  }, [rows]);

  async function add() {
    setError("");
    if (!form.userId || !form.day || !form.start || !form.end) {
      setError("Выберите сотрудника, день, начало и конец");
      return;
    }
    try {
      const startsAt = `${form.day}T${form.start}`;
      const endsAt = `${form.day}T${form.end}`;
      await api.post("/schedule", {
        venueId: selectedVenueId,
        userId: form.userId,
        startsAt,
        endsAt,
      });
      setForm({ userId: "", day: "", start: "12:00", end: "22:00" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось поставить смену");
    }
  }

  async function arrive(id: string) {
    await api.post(`/schedule/${id}/arrive`);
    load();
  }

  const employeeName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e?.name || e?.nickname || id.slice(0, 8);
  };

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">График смен</h1>
      {error ? <p className="text-sm text-red-400">{String(error)}</p> : null}

      <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-4">
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
                {e.name || e.nickname || e.phone || e.id}
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
            <input
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3"
            />
          </label>
          <label className="text-sm">
            Конец
            <input
              type="time"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3"
            />
          </label>
        </div>
        <button type="button" onClick={add} className="min-h-12 rounded-xl bg-cyan font-semibold text-black md:col-span-4">
          Добавить
        </button>
      </div>

      <p className="text-sm text-text-secondary">
        В этом списке опозданий: {monthLate}. Сейчас: {toLocalInput(new Date()).replace("T", " ")}
      </p>

      <h2 className="text-lg font-semibold">Мои смены</h2>
      {mine.map((row) => (
        <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
          <p>
            {new Date(row.startsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })} —{" "}
            {new Date(row.endsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}
          </p>
          <p>
            {row.arrivedAt
              ? `Пришёл ${new Date(row.arrivedAt).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty" })}`
              : "Ещё не отмечен"}
          </p>
          {!row.arrivedAt ? (
            <button type="button" onClick={() => arrive(row.id)} className="mt-2 min-h-11 rounded-xl bg-bg-card px-3">
              Я на месте
            </button>
          ) : null}
        </article>
      ))}

      <h2 className="text-lg font-semibold">Неделя по дням</h2>
      {weekGroups.length === 0 ? <p className="text-sm text-text-secondary">Смен пока нет</p> : null}
      {weekGroups.map(([day, list]) => (
        <div key={day} className="rounded-xl bg-bg-secondary p-3">
          <p className="mb-2 font-semibold capitalize">{day}</p>
          <ul className="space-y-2 text-sm">
            {list.map((row) => {
              const late =
                row.arrivedAt &&
                new Date(row.arrivedAt).getTime() - new Date(row.startsAt).getTime() > 10 * 60 * 1000;
              return (
                <li key={row.id} className={late ? "text-red-400" : "text-text-secondary"}>
                  {employeeName(row.userId)} ·{" "}
                  {new Date(row.startsAt).toLocaleTimeString("ru-RU", {
                    timeZone: "Asia/Almaty",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  –
                  {new Date(row.endsAt).toLocaleTimeString("ru-RU", {
                    timeZone: "Asia/Almaty",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {row.arrivedAt ? (late ? " · опоздание" : " · пришёл") : " · нет отметки"}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
