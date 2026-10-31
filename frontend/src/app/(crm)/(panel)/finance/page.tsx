"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function FinancePage() {
  const { selectedVenueId } = useCrmVenue();
  const [pnl, setPnl] = useState<any>(null);
  const [error, setError] = useState("");
  const [expense, setExpense] = useState({ amountTenge: "", category: "Прочее", article: "Прочее", comment: "" });

  async function load() {
    if (!selectedVenueId) return;
    const { data } = await api.get("/finance/pnl", { params: { venueId: selectedVenueId, year: new Date().getFullYear() } });
    setPnl(data);
  }

  async function add() {
    setError("");
    try {
      await api.post("/expenses", {
        venueId: selectedVenueId,
        occurredOn: new Date().toISOString(),
        amountTenge: Number(expense.amountTenge),
        category: expense.category,
        article: expense.article,
        comment: expense.comment,
        payMethod: "OWNER_CARD",
      });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Только владелец вносит расходы");
    }
  }

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">Финансы</h1>
      <button type="button" onClick={() => load().catch((e) => setError(e?.response?.data?.message || "Нет доступа"))} className="min-h-11 rounded-xl bg-bg-secondary px-4">Показать P&L</button>
      {error && <p className="text-sm text-red-400">{String(error)}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-text-secondary"><th className="sticky left-0 bg-bg-card p-2">Месяц</th><th>Выручка</th><th>Расходы</th><th>Прибыль</th><th>Маржа</th></tr>
          </thead>
          <tbody>
            {pnl?.months?.map((row: any) => (
              <tr key={row.month} className="border-t border-white/10">
                <td className="sticky left-0 bg-bg-card p-2">{row.month}</td>
                <td className="p-2">{row.revenue}</td>
                <td className="p-2">{row.expenses}</td>
                <td className="p-2">{row.profit}</td>
                <td className="p-2">{row.margin}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-2">
        <input inputMode="numeric" placeholder="Сумма" value={expense.amountTenge} onChange={(e) => setExpense({ ...expense, amountTenge: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3 text-base" />
        <input placeholder="Статья" value={expense.article} onChange={(e) => setExpense({ ...expense, article: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3 text-base" />
        <button type="button" onClick={add} className="min-h-12 rounded-xl bg-cyan font-semibold text-black">Расход</button>
      </div>
    </div>
  );
}
