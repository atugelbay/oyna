"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function CashPage() {
  const { selectedVenueId } = useCrmVenue();
  const [shift, setShift] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [error, setError] = useState("");
  const [waterQty, setWaterQty] = useState("1");
  const [method, setMethod] = useState("CASH");

  async function load() {
    if (!selectedVenueId) return;
    const { data } = await api.get("/cash/shifts/current", { params: { venueId: selectedVenueId } });
    setShift(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Нет смены"));
  }, [selectedVenueId]);

  async function openShift() {
    setError("");
    try {
      await api.post("/cash/shifts/open", { venueId: selectedVenueId, openingCash: Number(openingCash) });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось открыть смену");
    }
  }

  async function sellWater() {
    setError("");
    const qty = Number(waterQty);
    try {
      await api.post("/cash/catalog/water", {}, { params: { venueId: selectedVenueId } });
      const catalog = await api.get("/cash/catalog", { params: { venueId: selectedVenueId } });
      const water = (catalog.data as any[]).find((item) => item.name === "Вода 0,5 л");
      await api.post("/cash/sales", {
        venueId: selectedVenueId,
        lines: [{ itemId: water?.id, name: "Вода 0,5 л", qty, priceTenge: 500, minutes: 0 }],
        payments: [{ method, amountTenge: 500 * qty, cashReceived: method === "CASH" ? 500 * qty : undefined }],
      });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Продажа не прошла");
    }
  }

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">Касса</h1>
      <p className="text-sm text-amber-300">Оплаченные минуты действуют 24 часа. Без открытой смены продажа закрыта.</p>
      {error && <p className="text-sm text-red-400">{String(error)}</p>}
      {!shift ? (
        <div className="rounded-xl bg-bg-secondary p-4">
          <label className="mb-2 block text-sm">Наличные на начало</label>
          <input inputMode="numeric" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="mb-3 h-12 w-full rounded-xl bg-bg-card px-3 text-base" />
          <button type="button" onClick={openShift} className="min-h-12 rounded-xl bg-cyan px-4 font-semibold text-black">Открыть смену</button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-bg-secondary p-4">
          <p>Смена №{shift.number} открыта</p>
          <div className="flex flex-wrap gap-2">
            {["CASH", "KASPI", "HALYK", "FREEDOM"].map((item) => (
              <button key={item} type="button" onClick={() => setMethod(item)} className={`min-h-11 rounded-xl px-3 ${method === item ? "bg-cyan text-black" : "bg-bg-card"}`}>{item}</button>
            ))}
          </div>
          <input inputMode="numeric" value={waterQty} onChange={(e) => setWaterQty(e.target.value)} className="h-12 w-24 rounded-xl bg-bg-card px-3 text-base" />
          <button type="button" onClick={sellWater} className="min-h-12 rounded-xl bg-cyan px-4 font-semibold text-black">Вода 500 ₸</button>
        </div>
      )}
    </div>
  );
}
