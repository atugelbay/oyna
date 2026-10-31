"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function SchedulePage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: "", startsAt: "", endsAt: "" });
  const [error, setError] = useState("");

  function load() {
    if (!selectedVenueId) return;
    api.get("/schedule", { params: { venueId: selectedVenueId } })
      .then(({ data }) => setRows(data))
      .catch((e) => setError(e?.response?.data?.message || "График видит владелец"));
    api.get("/schedule/me").then(({ data }) => setMine(data)).catch(() => setMine([]));
  }

  useEffect(() => { load(); }, [selectedVenueId]);

  async function add() {
    setError("");
    try {
      await api.post("/schedule", { venueId: selectedVenueId, ...form });
      setForm({ userId: "", startsAt: "", endsAt: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось поставить смену");
    }
  }

  async function arrive(id: string) {
    await api.post(`/schedule/${id}/arrive`);
    load();
  }

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">График смен</h1>
      {error && <p className="text-sm text-red-400">{String(error)}</p>}
      <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-4">
        <input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="ID сотрудника" className="min-h-12 rounded-xl bg-bg-card px-3" />
        <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" />
        <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" />
        <button type="button" onClick={add} className="min-h-12 rounded-xl bg-cyan font-semibold text-black">Добавить</button>
      </div>
      <h2 className="text-lg font-semibold">Мои смены</h2>
      {mine.map((row) => (
        <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
          <p>{new Date(row.startsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })} — {new Date(row.endsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}</p>
          <p>{row.arrivedAt ? `Пришёл ${new Date(row.arrivedAt).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty" })}` : "Ещё не отмечен"}</p>
          {!row.arrivedAt && <button type="button" onClick={() => arrive(row.id)} className="mt-2 min-h-11 rounded-xl bg-bg-card px-3">Я на месте</button>}
        </article>
      ))}
      <h2 className="text-lg font-semibold">Точка</h2>
      {rows.map((row) => (
        <p key={row.id} className="text-sm text-text-secondary">
          {row.userId.slice(0, 8)} · {new Date(row.startsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}
          {row.arrivedAt ? " · пришёл" : " · нет отметки"}
        </p>
      ))}
    </div>
  );
}
