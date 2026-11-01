"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";
import { payMethodLabel, saleStatusLabel } from "@/lib/crm-labels";

const METHODS = ["", "CASH", "KASPI", "HALYK", "FREEDOM"] as const;

export default function PaymentsPage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("");
  const [cancelledOnly, setCancelledOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const { data } = await api.get("/cash/sales", {
        params: {
          venueId: selectedVenueId || undefined,
          method: method || undefined,
          cancelled: cancelledOnly ? "1" : undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 100,
        },
      });
      setRows(data.data ?? []);
      setTotals(data.totals);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Нет доступа");
    }
  }

  useEffect(() => {
    void load();
  }, [selectedVenueId, method, cancelledOnly, from, to]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const blob = [
        row.operatorName,
        row.playerNickname,
        row.playerPhone,
        row.number,
        ...(row.lines?.map((l: any) => l.name) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q]);

  const byMethod = useMemo(() => {
    const map: Record<string, number> = { CASH: 0, KASPI: 0, HALYK: 0, FREEDOM: 0 };
    for (const row of filtered) {
      if (row.status === "CANCELLED") continue;
      for (const pay of row.payments ?? []) {
        map[pay.method] = (map[pay.method] ?? 0) + pay.amountTenge;
      }
    }
    return map;
  }, [filtered]);

  async function cancelSelected() {
    if (!selected) return;
    const reason = window.prompt("Причина отмены", "Отмена владельцем");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await api.post(`/cash/sales/${selected.id}/cancel`, { reason: reason.trim() });
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Отмена не прошла");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-text-primary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Оплаты</h1>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm"
          onClick={async () => {
            const { data } = await api.get("/cash/sales/export", {
              params: { venueId: selectedVenueId || undefined },
              responseType: "blob",
            });
            const url = URL.createObjectURL(data);
            const link = document.createElement("a");
            link.href = url;
            link.download = "oyna-sales.xls";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Скачать Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm" />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm">
          <option value="">Все способы</option>
          {METHODS.filter(Boolean).map((m) => (
            <option key={m} value={m}>
              {payMethodLabel(m)}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl bg-bg-secondary px-3 text-sm">
          <input type="checkbox" checked={cancelledOnly} onChange={(e) => setCancelledOnly(e.target.checked)} />
          Только отменённые
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск"
          className="min-h-11 min-w-[10rem] flex-1 rounded-xl bg-bg-secondary px-3 text-sm"
        />
      </div>

      {totals ? (
        <p className="text-sm text-text-secondary">
          {totals.count} оплат · {totals.sum} ₸ · средний {totals.average} ₸
        </p>
      ) : null}
      <p className="text-sm text-text-secondary">
        {Object.entries(byMethod)
          .filter(([, sum]) => sum > 0)
          .map(([m, sum]) => `${payMethodLabel(m)} ${sum} ₸`)
          .join(" · ") || "Нет проведённых оплат в выборке"}
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="space-y-2">
        {filtered.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setSelected(row)}
            className="flex w-full flex-col gap-1 rounded-xl bg-bg-secondary p-3 text-left text-sm hover:bg-white/5"
          >
            <span className="font-semibold">
              №{row.number} · {row.totalTenge} ₸ · {saleStatusLabel(row.status)}
            </span>
            <span className="text-text-secondary">
              {new Date(row.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })} · {row.operatorName}
              {row.shift?.number != null ? ` · смена ${row.shift.number}` : ""}
            </span>
            <span className="text-text-secondary">
              {(row.payments ?? []).map((p: any) => `${payMethodLabel(p.method)} ${p.amountTenge}`).join(", ")}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#141C26] p-5">
            <h2 className="text-lg font-semibold">Оплата №{selected.number}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {saleStatusLabel(selected.status)} · {new Date(selected.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums">{selected.totalTenge} ₸</p>
            <div className="mt-4 space-y-2 text-sm">
              <p>Оператор: {selected.operatorName}</p>
              <p>Смена: {selected.shift?.number ?? "—"}</p>
              <p>Игрок: {selected.playerNickname ?? "без аккаунта"}{selected.playerPhone ? ` · ${selected.playerPhone}` : ""}</p>
              <p>Минуты: {selected.minutesCredited ?? 0}</p>
              <p>Чек: {selected.receiptChecked ? "пробит" : "не отмечен"}{selected.receiptNumber ? ` · ${selected.receiptNumber}` : ""}</p>
              <p className="font-medium">Состав</p>
              <ul className="list-disc pl-5">
                {(selected.lines ?? []).map((l: any) => (
                  <li key={l.id}>
                    {l.name} × {l.qty} — {l.priceTenge * l.qty} ₸
                    {l.minutes ? ` · ${l.minutes * l.qty} мин` : ""}
                  </li>
                ))}
              </ul>
              <p className="font-medium">Оплата</p>
              <ul className="list-disc pl-5">
                {(selected.payments ?? []).map((p: any) => (
                  <li key={p.id}>
                    {payMethodLabel(p.method)} {p.amountTenge} ₸
                    {p.changeTenge != null ? ` · сдача ${p.changeTenge}` : ""}
                  </li>
                ))}
              </ul>
              {selected.cancelReason ? <p>Причина отмены: {selected.cancelReason}</p> : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {selected.status !== "CANCELLED" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelSelected}
                  className="min-h-12 rounded-xl bg-bg-card px-4"
                >
                  Отменить
                </button>
              ) : null}
              <button type="button" className="min-h-12 rounded-xl bg-cyan px-4 font-semibold text-black" onClick={() => setSelected(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
