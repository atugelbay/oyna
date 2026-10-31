"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function BookingsPage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "BIRTHDAY",
    startsAt: "",
    contactName: "",
    contactPhone: "",
    packageName: "STANDARD",
    packageMinutes: 60,
    packagePrice: 80000,
    people: 10,
    prepayTenge: 10000,
    sourceCode: "instagram",
  });

  async function load() {
    const { data } = await api.get("/bookings", { params: { venueId: selectedVenueId || undefined } });
    setRows(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Не загрузилось"));
  }, [selectedVenueId]);

  async function createBooking() {
    setError("");
    try {
      await api.post("/bookings", { ...form, venueId: selectedVenueId, packageMinutes: Number(form.packageMinutes), packagePrice: Number(form.packagePrice), people: Number(form.people), prepayTenge: Number(form.prepayTenge) });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не создано");
    }
  }

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">Бронирования</h1>
      {error && <p className="text-sm text-red-400">{String(error)}</p>}
      <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-2">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3">
          <option value="BIRTHDAY">День рождения</option>
          <option value="TEAMBUILDING">Тимбилдинг</option>
        </select>
        <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3 text-base" />
        <input placeholder="Контакт" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3 text-base" />
        <input inputMode="tel" placeholder="Телефон" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3 text-base" />
        <input inputMode="numeric" placeholder="Человек" value={form.people} onChange={(e) => setForm({ ...form, people: Number(e.target.value) })} className="min-h-12 rounded-xl bg-bg-card px-3 text-base" />
        <button type="button" onClick={createBooking} className="min-h-12 rounded-xl bg-cyan font-semibold text-black">Создать</button>
      </div>
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
          <p className="font-semibold">{row.type === "BIRTHDAY" ? "ДР" : "Тимбилдинг"} · {row.contactName}</p>
          <p>{new Date(row.startsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })} · {row.people} чел · {row.amountTenge} ₸</p>
          <p>Предоплата {row.prepayTenge} ₸ · остаток {row.amountTenge - row.prepayTenge} ₸ · {row.status}</p>
        </article>
      ))}
    </div>
  );
}
