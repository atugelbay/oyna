"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function CertificatesPage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "Подарочный сертификат", minutes: "60", priceTenge: "15000" });
  const [activate, setActivate] = useState({ code: "", userId: "" });
  const [error, setError] = useState("");

  function load() {
    api.get("/certificates", { params: { venueId: selectedVenueId || undefined } })
      .then(({ data }) => setRows(data))
      .catch((e) => setError(e?.response?.data?.message || "Не удалось загрузить сертификаты"));
  }

  useEffect(() => { load(); }, [selectedVenueId]);

  async function issue() {
    setError("");
    try {
      await api.post("/certificates", {
        venueId: selectedVenueId,
        title: form.title,
        minutes: Number(form.minutes),
        priceTenge: Number(form.priceTenge),
      });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось выдать сертификат");
    }
  }

  async function activateCode() {
    setError("");
    try {
      await api.post("/certificates/activate", activate);
      setActivate({ code: "", userId: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Сертификат не активирован");
    }
  }

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">Сертификаты</h1>
      {error && <p className="text-sm text-red-400">{String(error)}</p>}
      <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-4">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" />
        <input inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" placeholder="Минуты, кратно 10" />
        <input inputMode="numeric" value={form.priceTenge} onChange={(e) => setForm({ ...form, priceTenge: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" placeholder="Цена ₸" />
        <button type="button" onClick={issue} className="min-h-12 rounded-xl bg-cyan font-semibold text-black">Выдать</button>
      </div>
      <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-3">
        <input value={activate.code} onChange={(e) => setActivate({ ...activate, code: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" placeholder="Код" />
        <input value={activate.userId} onChange={(e) => setActivate({ ...activate, userId: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" placeholder="ID игрока" />
        <button type="button" onClick={activateCode} className="min-h-12 rounded-xl bg-bg-card font-semibold">Активировать</button>
      </div>
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
          <p className="font-semibold">{row.code} · {row.minutes} мин · {row.priceTenge} ₸</p>
          <p>{row.status} · активировать до {new Date(row.activateBy).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" })}</p>
        </article>
      ))}
    </div>
  );
}
