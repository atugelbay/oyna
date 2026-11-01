"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

type Tab = "pnl" | "expenses" | "days" | "rooms";

export default function FinancePage() {
  const { selectedVenueId } = useCrmVenue();
  const year = new Date().getFullYear();
  const monthNow = new Date().getMonth() + 1;
  const [tab, setTab] = useState<Tab>("pnl");
  const [pnl, setPnl] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any>(null);
  const [error, setError] = useState("");
  const [expense, setExpense] = useState({ amountTenge: "", category: "Прочее", article: "Прочее", comment: "" });
  const [plan, setPlan] = useState("0");

  async function loadPnl() {
    if (!selectedVenueId) return;
    const { data } = await api.get("/finance/pnl", { params: { venueId: selectedVenueId, year } });
    setPnl(data);
  }

  async function loadExpenses() {
    const { data } = await api.get("/expenses", { params: { venueId: selectedVenueId || undefined } });
    setExpenses(data ?? []);
  }

  async function loadRooms() {
    if (!selectedVenueId) return;
    const from = `${year}-${String(monthNow).padStart(2, "0")}-01`;
    const to = new Date(year, monthNow, 0).toISOString().slice(0, 10);
    const { data } = await api.get("/finance/rooms", { params: { venueId: selectedVenueId, from, to } });
    setRooms(data);
  }

  useEffect(() => {
    loadPnl().catch((e) => setError(e?.response?.data?.message || "Нет доступа к P&L"));
    loadExpenses().catch(() => setExpenses([]));
    if (!selectedVenueId) return;
    api
      .get("/finance/plan", { params: { venueId: selectedVenueId, year, month: monthNow } })
      .then(({ data }) => {
        if (data?.planTenge != null) setPlan(String(data.planTenge));
      })
      .catch(() => undefined);
  }, [selectedVenueId]);

  const current = pnl?.months?.find((m: any) => m.month === monthNow);
  const prev = pnl?.months?.find((m: any) => m.month === monthNow - 1);
  const planNum = Number(plan) || 0;
  const kpi = useMemo(() => {
    const revenue = current?.revenue ?? 0;
    const spent = current?.expenses ?? 0;
    const profit = current?.profit ?? 0;
    const margin = current?.margin ?? 0;
    const prevRevenue = prev?.revenue ?? 0;
    const vsPrev = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
    return { revenue, spent, profit, margin, vsPrev };
  }, [current, prev]);

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
      setExpense({ amountTenge: "", category: "Прочее", article: "Прочее", comment: "" });
      await Promise.all([loadPnl(), loadExpenses()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Только владелец вносит расходы");
    }
  }

  async function savePlan() {
    setError("");
    try {
      const { data: existing } = await api
        .get("/finance/plan", { params: { venueId: selectedVenueId, year, month: monthNow } })
        .catch(() => ({ data: null }));
      await api.post("/finance/plan", {
        venueId: selectedVenueId,
        year,
        month: monthNow,
        planTenge: planNum,
        overplanTenge: existing?.overplanTenge ?? planNum,
        rateBelow: existing?.rateBelow ?? 5,
        rateAt: existing?.rateAt ?? 7,
        rateOver: existing?.rateOver ?? 10,
        bookingRate: existing?.bookingRate ?? 10,
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || "План не сохранился");
    }
  }

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">Финансы</h1>
      {error ? <p className="text-sm text-red-400">{String(error)}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-bg-secondary p-4">
          <p className="text-xs text-text-secondary">Выручка</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.revenue.toLocaleString("ru-KZ")} ₸</p>
        </div>
        <div className="rounded-xl bg-bg-secondary p-4">
          <p className="text-xs text-text-secondary">Расходы</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.spent.toLocaleString("ru-KZ")} ₸</p>
        </div>
        <div className="rounded-xl bg-bg-secondary p-4">
          <p className="text-xs text-text-secondary">Прибыль · маржа</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {kpi.profit.toLocaleString("ru-KZ")} ₸ · {kpi.margin}%
          </p>
        </div>
        <div className="rounded-xl bg-bg-secondary p-4">
          <p className="text-xs text-text-secondary">К прошлому месяцу</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {kpi.vsPrev == null ? "—" : `${kpi.vsPrev > 0 ? "+" : ""}${kpi.vsPrev}%`}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-bg-secondary p-4">
        <p className="mb-2 text-sm font-medium">План месяца</p>
        <div className="flex flex-wrap gap-2">
          <input
            inputMode="numeric"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="min-h-12 rounded-xl bg-bg-card px-3"
            placeholder="Сумма плана"
          />
          <button type="button" onClick={savePlan} className="min-h-12 rounded-xl bg-bg-card px-4">
            Сохранить план
          </button>
        </div>
        {planNum > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-text-secondary">
              <span>Прогресс</span>
              <span>{Math.min(100, Math.round((kpi.revenue / planNum) * 100))}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-bg-card">
              <div
                className="h-full rounded-full bg-cyan"
                style={{ width: `${Math.min(100, Math.round((kpi.revenue / planNum) * 100))}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pnl", "P&L"],
            ["expenses", "Расходы"],
            ["days", "По месяцам"],
            ["rooms", "Комнаты"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id === "rooms") void loadRooms().catch((e) => setError(e?.response?.data?.message || "Нет данных по комнатам"));
            }}
            className={`min-h-11 rounded-xl px-3 ${tab === id ? "bg-cyan text-black" : "bg-bg-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pnl" || tab === "days" ? (
        <div className="overflow-x-auto rounded-xl bg-bg-secondary p-3">
          <table className="min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="p-2">Месяц</th>
                <th>Выручка</th>
                <th>Расходы</th>
                <th>Прибыль</th>
                <th>Маржа</th>
              </tr>
            </thead>
            <tbody>
              {pnl?.months?.map((row: any) => (
                <tr key={row.month} className="border-t border-white/10">
                  <td className="p-2">{MONTHS[row.month - 1]}</td>
                  <td className="p-2 tabular-nums">{row.revenue.toLocaleString("ru-KZ")}</td>
                  <td className="p-2 tabular-nums">{row.expenses.toLocaleString("ru-KZ")}</td>
                  <td className="p-2 tabular-nums">{row.profit.toLocaleString("ru-KZ")}</td>
                  <td className="p-2">{row.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "expenses" ? (
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-2">
            <input
              inputMode="numeric"
              placeholder="Сумма"
              value={expense.amountTenge}
              onChange={(e) => setExpense({ ...expense, amountTenge: e.target.value })}
              className="min-h-12 rounded-xl bg-bg-card px-3 text-base"
            />
            <input
              placeholder="Статья"
              value={expense.article}
              onChange={(e) => setExpense({ ...expense, article: e.target.value })}
              className="min-h-12 rounded-xl bg-bg-card px-3 text-base"
            />
            <input
              placeholder="Комментарий"
              value={expense.comment}
              onChange={(e) => setExpense({ ...expense, comment: e.target.value })}
              className="min-h-12 rounded-xl bg-bg-card px-3 text-base md:col-span-2"
            />
            <button type="button" onClick={add} className="min-h-12 rounded-xl bg-cyan font-semibold text-black md:col-span-2">
              Добавить расход
            </button>
          </div>
          {expenses.map((row) => (
            <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
              <p className="font-semibold">
                {row.amountTenge?.toLocaleString("ru-KZ")} ₸ · {row.article}
              </p>
              <p className="text-text-secondary">
                {new Date(row.occurredOn).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" })} · {row.category}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "rooms" ? (
        <div className="rounded-xl bg-bg-secondary p-4 text-sm">
          {Array.isArray(rooms) ? (
            <table className="w-full text-left">
              <thead>
                <tr className="text-text-secondary">
                  <th className="py-2">Комната</th>
                  <th>Выручка</th>
                  <th>Сессии</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((row: any, i: number) => (
                  <tr key={row.roomId || row.id || i} className="border-t border-white/10">
                    <td className="py-2">{row.roomName || row.name || "—"}</td>
                    <td className="tabular-nums">{Number(row.revenue ?? row.totalTenge ?? 0).toLocaleString("ru-KZ")} ₸</td>
                    <td>{row.sessions ?? row.count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : rooms ? (
            <pre className="whitespace-pre-wrap text-text-secondary">{JSON.stringify(rooms, null, 2)}</pre>
          ) : (
            <p className="text-text-secondary">Нажмите вкладку ещё раз или подождите загрузку</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
