"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";
import { formatTenge } from "@/lib/money";
import { almatyToday } from "@/lib/almaty";
import { readApiUserError } from "@/lib/api-error-message";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

type Period = "day" | "week" | "month" | "custom";
type Tab = "pnl" | "revenue" | "expenses" | "days" | "months" | "rooms";

type Overview = {
  period: { label: string };
  previousPeriod: { label: string };
  revenue: number;
  previousRevenue: number;
  revenueChange: number | null;
  expenses: number;
  expensesChange: number | null;
  profit: number;
  previousProfit: number;
  margin: number;
  sales: number;
  averageCheck: number;
  refunds: number;
  barter: { sales: number; minutes: number };
  byMethod: { method: string; label: string; amount: number }[];
  byGroup: { group: string; label: string; amount: number }[];
  byOperator: { operatorId: string; name: string; amount: number; sales: number }[];
  byDay: { day: string; revenue: number; expenses: number; profit: number }[];
};

function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="text-text-muted">нет сравнения</span>;
  return <span className={value >= 0 ? "text-success" : "text-red-400"}>{`${value > 0 ? "+" : ""}${value}%`}</span>;
}

function Bars({ rows }: { rows: { label: string; amount: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm">
            <span>{r.label}</span>
            <span className="tabular-nums">{formatTenge(r.amount)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg-card">
            <div className={`h-full rounded-full ${r.amount < 0 ? "bg-red-400" : "bg-cyan"}`} style={{ width: `${(Math.abs(r.amount) / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 ? <li className="text-sm text-text-secondary">Нет данных</li> : null}
    </ul>
  );
}

export default function FinancePage() {
  const { selectedVenueId } = useCrmVenue();
  const today = almatyToday();
  const thisMonth = today.slice(0, 7);
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(`${thisMonth}-01`);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>("pnl");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [planInput, setPlanInput] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const params = useCallback(
    () => ({ venueId: selectedVenueId, period, ...(period === "custom" ? { from, to } : {}) }),
    [selectedVenueId, period, from, to],
  );

  const loadOverview = useCallback(() => {
    if (!selectedVenueId) return;
    api
      .get("/finance/overview", { params: params() })
      .then(({ data }) => {
        setOverview(data);
        setError("");
      })
      .catch((e) => setError(readApiUserError(e, "Финансы видит владелец")));
  }, [selectedVenueId, params]);

  const loadPlan = useCallback(() => {
    if (!selectedVenueId) return;
    api
      .get("/finance/plan-progress", { params: { venueId: selectedVenueId, month: thisMonth } })
      .then(({ data }) => {
        setPlan(data);
        setPlanInput(String(data.plan || ""));
      })
      .catch(() => setPlan(null));
  }, [selectedVenueId, thisMonth]);

  useEffect(() => loadOverview(), [loadOverview]);
  useEffect(() => loadPlan(), [loadPlan]);

  async function savePlan() {
    setError("");
    setOk("");
    const amount = Number(planInput.replace(/\s/g, ""));
    if (!Number.isFinite(amount) || amount < 0) return setError("Сумма плана — число");
    try {
      const [y, m] = thisMonth.split("-").map(Number);
      const { data: existing } = await api
        .get("/finance/plan", { params: { venueId: selectedVenueId, year: y, month: m } })
        .catch(() => ({ data: null }));
      await api.post("/finance/plan", {
        venueId: selectedVenueId,
        year: y,
        month: m,
        planTenge: amount,
        overplanTenge: existing?.overplanTenge ?? amount,
        rateBelow: existing?.rateBelow ?? 5,
        rateAt: existing?.rateAt ?? 7,
        rateOver: existing?.rateOver ?? 10,
        bookingRate: existing?.bookingRate ?? 10,
      });
      setOk("План сохранён");
      loadPlan();
    } catch (e) {
      setError(readApiUserError(e, "План не сохранился"));
    }
  }

  const o = overview;

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">Финансы</h1>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["day", "День"],
            ["week", "Неделя"],
            ["month", "Месяц"],
            ["custom", "Свой период"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriod(id)}
            className={`min-h-11 rounded-xl px-3 text-sm ${period === id ? "bg-cyan text-black" : "bg-bg-secondary"}`}
          >
            {label}
          </button>
        ))}
        {period === "custom" ? (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm" />
          </>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}

      {o ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Выручка" value={formatTenge(o.revenue)} sub={<>к «{o.previousPeriod.label}»: <Change value={o.revenueChange} /></>} />
          <Kpi title="Расходы" value={formatTenge(o.expenses)} sub={<>к прошлому: <Change value={o.expensesChange} /></>} />
          <Kpi title="Прибыль · маржа" value={`${formatTenge(o.profit)} · ${o.margin}%`} sub={<>прошлый: {formatTenge(o.previousProfit)}</>} />
          <Kpi
            title="Продаж · средний чек"
            value={`${o.sales} · ${formatTenge(o.averageCheck)}`}
            sub={
              <>
                {o.refunds ? `возвраты ${formatTenge(o.refunds)}` : "возвратов нет"}
                {o.barter.sales ? ` · бартер: ${o.barter.sales} продаж, ${o.barter.minutes} минут` : ""}
              </>
            }
          />
        </div>
      ) : null}

      <div className="rounded-xl bg-bg-secondary p-4">
        <p className="mb-2 text-sm font-medium">План месяца</p>
        <div className="flex flex-wrap gap-2">
          <input
            inputMode="numeric"
            value={planInput}
            onChange={(e) => setPlanInput(e.target.value)}
            className="min-h-11 rounded-xl bg-bg-card px-3"
            placeholder="Сумма плана"
          />
          <button type="button" onClick={() => void savePlan()} className="min-h-11 rounded-xl bg-bg-card px-4">
            Сохранить план
          </button>
        </div>
        {plan && plan.plan > 0 ? (
          <div className="mt-3 space-y-1 text-sm">
            <div className="h-3 overflow-hidden rounded-full bg-bg-card">
              <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.min(100, plan.percent ?? 0)}%` }} />
            </div>
            <p>
              Факт {formatTenge(plan.fact)} из {formatTenge(plan.plan)} — <b>{plan.percent}%</b>. Прогноз на конец месяца по темпу:{" "}
              <b className={plan.forecastPercent >= 100 ? "text-success" : "text-amber-300"}>
                {formatTenge(plan.forecast)} ({plan.forecastPercent}%)
              </b>
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pnl", "P&L"],
            ["revenue", "Выручка"],
            ["expenses", "Расходы"],
            ["days", "По дням"],
            ["months", "По месяцам"],
            ["rooms", "Комнаты"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-xl px-3 ${tab === id ? "bg-cyan text-black" : "bg-bg-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pnl" ? <PnlArticles venueId={selectedVenueId} month={thisMonth} /> : null}
      {tab === "revenue" && o ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="По способам оплаты">
            <Bars rows={o.byMethod} />
          </Panel>
          <Panel title="По группам">
            <Bars rows={o.byGroup} />
          </Panel>
          <Panel title="По операторам">
            <Bars rows={o.byOperator.map((r) => ({ label: `${r.name} (${r.sales})`, amount: r.amount }))} />
          </Panel>
        </div>
      ) : null}
      {tab === "expenses" ? (
        <Expenses
          venueId={selectedVenueId}
          month={thisMonth}
          onChanged={() => {
            loadOverview();
            loadPlan();
          }}
        />
      ) : null}
      {tab === "days" && o ? (
        <Panel title={`По дням · ${o.period.label}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-1">День</th>
                <th>Выручка</th>
                <th>Расходы</th>
                <th>Итог</th>
              </tr>
            </thead>
            <tbody>
              {o.byDay.map((d) => (
                <tr key={d.day} className="border-t border-white/10">
                  <td className="py-2">
                    {d.day.slice(8)}.{d.day.slice(5, 7)}
                  </td>
                  <td className="tabular-nums">{formatTenge(d.revenue)}</td>
                  <td className="tabular-nums">{formatTenge(d.expenses)}</td>
                  <td className={`tabular-nums ${d.profit < 0 ? "text-red-400" : ""}`}>{formatTenge(d.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {o.byDay.length === 0 ? <p className="text-sm text-text-secondary">Нет данных</p> : null}
        </Panel>
      ) : null}
      {tab === "months" ? <Months venueId={selectedVenueId} /> : null}
      {tab === "rooms" ? <Rooms params={params()} /> : null}
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-bg-secondary p-4">
      <p className="text-xs text-text-secondary">{title}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{sub}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-bg-secondary p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PnlArticles({ venueId, month }: { venueId: string | null; month: string }) {
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [bench, setBench] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!venueId) return;
    api
      .get("/finance/pnl-articles", { params: { venueId, month } })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(readApiUserError(e, "P&L не загрузился")));
  }, [venueId, month]);

  useEffect(() => load(), [load]);

  async function startEdit() {
    const [{ data: cats }, { data: current }] = await Promise.all([
      api.get("/finance/expense-categories"),
      api.get("/finance/benchmarks"),
    ]);
    setBench(Object.fromEntries((cats as string[]).map((c) => [c, current?.[c] != null ? String(current[c]) : ""])));
    setEditing(true);
  }

  async function saveBench() {
    const body = Object.fromEntries(
      Object.entries(bench)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => [k, Number(v.replace(",", "."))]),
    );
    await api.put("/finance/benchmarks", body).catch((e) => setError(readApiUserError(e, "Не сохранилось")));
    setEditing(false);
    load();
  }

  if (!data) return error ? <p className="text-sm text-red-400">{error}</p> : null;
  return (
    <Panel title={`P&L по статьям · ${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`}>
      <p className="mb-3 text-sm">
        Выручка <b>{formatTenge(data.revenue)}</b> · расходы {formatTenge(data.expenses)} · прибыль{" "}
        <b className={data.profit < 0 ? "text-red-400" : "text-success"}>{formatTenge(data.profit)}</b> ({data.margin}%)
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-1">Статья</th>
            <th>Сумма</th>
            <th>% выручки</th>
            <th>Ориентир</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r: any) => (
            <tr key={r.category} className={`border-t border-white/10 ${r.over ? "text-red-400" : ""}`}>
              <td className="py-2">{r.category}</td>
              <td className="tabular-nums">{formatTenge(r.amount)}</td>
              <td className="tabular-nums">{r.percent != null ? `${r.percent}%` : "—"}</td>
              <td className="tabular-nums">{r.benchmark != null ? `≤ ${r.benchmark}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.rows.length === 0 ? <p className="text-sm text-text-secondary">Расходов в этом месяце нет</p> : null}
      {editing ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Object.entries(bench).map(([cat, v]) => (
            <label key={cat} className="flex items-center justify-between gap-2 text-sm">
              {cat}
              <input
                inputMode="decimal"
                value={v}
                onChange={(e) => setBench({ ...bench, [cat]: e.target.value })}
                placeholder="% выручки"
                className="h-10 w-24 rounded-lg bg-bg-card px-2"
              />
            </label>
          ))}
          <button type="button" onClick={() => void saveBench()} className="min-h-11 rounded-xl bg-cyan font-semibold text-black sm:col-span-2">
            Сохранить ориентиры
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void startEdit()} className="mt-3 text-sm text-cyan">
          Ориентиры по статьям
        </button>
      )}
    </Panel>
  );
}

function Expenses({ venueId, month, onChanged }: { venueId: string | null; month: string; onChanged: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [form, setForm] = useState({ amount: "", category: "Прочее", article: "", comment: "", day: almatyToday() });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(() => {
    if (!venueId) return;
    const [y, m] = month.split("-").map(Number);
    const fromIso = new Date(Date.UTC(y, m - 1, 1) - 5 * 3600000).toISOString();
    const toIso = new Date(Date.UTC(y, m, 1) - 5 * 3600000 - 1).toISOString();
    api
      .get("/expenses", { params: { venueId, from: fromIso, to: toIso } })
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, [venueId, month]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    api
      .get("/finance/expense-categories")
      .then(({ data }) => setCats(data))
      .catch(() => setCats(["Прочее"]));
  }, []);

  async function act(fn: () => Promise<unknown>, done: string) {
    setError("");
    setOk("");
    try {
      const res = await fn();
      setOk(typeof res === "string" && res ? res : done);
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error && !("response" in e) ? e.message : readApiUserError(e, "Не получилось"));
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 rounded-xl bg-bg-secondary p-4 md:grid-cols-2">
        <input
          inputMode="numeric"
          placeholder="Сумма"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="min-h-12 rounded-xl bg-bg-card px-3"
        />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3">
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          placeholder="Статья (например, «Аренда ноябрь»)"
          value={form.article}
          onChange={(e) => setForm({ ...form, article: e.target.value })}
          className="min-h-12 rounded-xl bg-bg-card px-3"
        />
        <input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="min-h-12 rounded-xl bg-bg-card px-3" />
        <input
          placeholder="Комментарий"
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          className="min-h-12 rounded-xl bg-bg-card px-3 md:col-span-2"
        />
        <button
          type="button"
          onClick={() =>
            void act(async () => {
              const amount = Number(form.amount.replace(/\s/g, ""));
              if (!Number.isFinite(amount) || amount < 1) throw new Error("Укажите сумму");
              await api.post("/expenses", {
                venueId,
                occurredOn: `${form.day}T12:00:00+05:00`,
                amountTenge: amount,
                category: form.category,
                article: form.article.trim() || form.category,
                comment: form.comment,
                payMethod: "OWNER_CARD",
              });
              setForm({ ...form, amount: "", article: "", comment: "" });
            }, "Расход добавлен")
          }
          className="min-h-12 rounded-xl bg-cyan font-semibold text-black"
        >
          Добавить расход
        </button>
        <button
          type="button"
          onClick={() =>
            void act(async () => {
              const { data } = await api.post("/expenses/repeat-last-month", { venueId, month });
              return `Повторено расходов: ${data.copied}${data.skipped ? `, уже были: ${data.skipped}` : ""}`;
            }, "Готово")
          }
          className="min-h-12 rounded-xl bg-bg-card"
        >
          Повторить прошлый месяц
        </button>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-secondary p-3 text-sm">
          <div>
            <p className="font-semibold">
              {formatTenge(row.amountTenge)} · {row.article}
            </p>
            <p className="text-text-secondary">
              {new Date(row.occurredOn).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" })} · {row.category}
              {row.payMethod === "CASH_REGISTER" ? " · из кассы" : ""}
              {row.comment ? ` · ${row.comment}` : ""}
            </p>
          </div>
          {row.payMethod !== "CASH_REGISTER" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = window.prompt("Новая сумма", String(row.amountTenge));
                  if (!next) return;
                  void act(() => api.patch(`/expenses/${row.id}`, { amountTenge: Number(next.replace(/\s/g, "")) }), "Сумма изменена");
                }}
                className="min-h-10 rounded-lg bg-bg-card px-3"
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Отменить этот расход?")) return;
                  void act(() => api.post(`/expenses/${row.id}/cancel`), "Расход отменён");
                }}
                className="min-h-10 rounded-lg bg-bg-card px-3"
              >
                Отменить
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {rows.length === 0 ? <p className="text-sm text-text-secondary">Расходов в этом месяце нет</p> : null}
    </div>
  );
}

function Months({ venueId }: { venueId: string | null }) {
  const year = Number(almatyToday().slice(0, 4));
  const [pnl, setPnl] = useState<any>(null);
  useEffect(() => {
    if (!venueId) return;
    api
      .get("/finance/pnl", { params: { venueId, year } })
      .then(({ data }) => setPnl(data))
      .catch(() => setPnl(null));
  }, [venueId, year]);
  return (
    <div className="overflow-x-auto rounded-xl bg-bg-secondary p-3">
      <table className="min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="p-2">Месяц</th>
            <th>Выручка</th>
            <th>Расходы</th>
            <th>Прибыль</th>
            <th>Маржа</th>
            <th>Бартер</th>
          </tr>
        </thead>
        <tbody>
          {pnl?.months?.map((row: any) => (
            <tr key={row.month} className="border-t border-white/10">
              <td className="p-2">{MONTHS[row.month - 1]}</td>
              <td className="p-2 tabular-nums">{formatTenge(row.revenue)}</td>
              <td className="p-2 tabular-nums">{formatTenge(row.expenses)}</td>
              <td className="p-2 tabular-nums">{formatTenge(row.profit)}</td>
              <td className="p-2">{row.margin}%</td>
              <td className="p-2 text-text-secondary">{row.barterSales ? `${row.barterSales} продаж, ${row.barterMinutes} мин` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rooms({ params }: { params: Record<string, unknown> }) {
  const [data, setData] = useState<any>(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!params.venueId) return;
    api
      .get("/finance/rooms-played", { params })
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <Panel title="Выручка по комнатам — по сыгранным оплаченным минутам">
      {data?.rooms?.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-1">Комната</th>
              <th>Выручка</th>
              <th>Доля</th>
              <th>Минут</th>
              <th>Сеансов</th>
            </tr>
          </thead>
          <tbody>
            {data.rooms.map((r: any) => (
              <tr key={r.roomId} className="border-t border-white/10">
                <td className="py-2">{r.name}</td>
                <td className="tabular-nums">{formatTenge(r.revenue)}</td>
                <td className="tabular-nums">{r.share}%</td>
                <td className="tabular-nums">{r.minutes}</td>
                <td className="tabular-nums">{r.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-text-secondary">Сеансов с оплаченными минутами за период нет</p>
      )}
      <p className="mt-2 text-xs text-text-muted">Оплаченные минуты сеанса × средняя цена минуты игрока (по его покупкам за 90 дней).</p>
    </Panel>
  );
}
