"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";
import { payMethodLabel, saleStatusLabel } from "@/lib/crm-labels";

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  priceTenge: number;
  priceWeekendTenge?: number | null;
  minutes?: number | null;
};

function isAlmatyWeekend(d = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Almaty",
    weekday: "short",
  }).format(d);
  return day === "Sat" || day === "Sun";
}

function catalogPrice(item: CatalogItem) {
  if (isAlmatyWeekend() && item.priceWeekendTenge != null) return item.priceWeekendTenge;
  return item.priceTenge;
}

type CartLine = {
  key: string;
  itemId?: string;
  name: string;
  qty: number;
  priceTenge: number;
  minutes: number;
};

type PayMethod = "CASH" | "KASPI" | "HALYK" | "FREEDOM";

const METHODS: PayMethod[] = ["CASH", "KASPI", "HALYK", "FREEDOM"];

type PlayerHit = { id: string; nickname: string; phone?: string };

export default function CashPage() {
  const { selectedVenueId } = useCrmVenue();
  const [shift, setShift] = useState<any>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [openingCash, setOpeningCash] = useState("0");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [playerQ, setPlayerQ] = useState("");
  const [playerHits, setPlayerHits] = useState<PlayerHit[]>([]);
  const [player, setPlayer] = useState<PlayerHit | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [receiptChecked, setReceiptChecked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ saleId: string; text: string } | null>(null);
  const [moveType, setMoveType] = useState<"IN" | "OUT" | "EXPENSE">("OUT");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveComment, setMoveComment] = useState("");
  const [closeForm, setCloseForm] = useState({
    cash: "",
    kaspi: "",
    halyk: "",
    freedom: "",
    comment: "",
  });
  const [expected, setExpected] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => cart.reduce((s, l) => s + l.priceTenge * l.qty, 0), [cart]);
  const minutes = useMemo(() => cart.reduce((s, l) => s + l.minutes * l.qty, 0), [cart]);
  const change =
    method === "CASH" && cashReceived !== ""
      ? Math.max(0, Number(cashReceived) - total)
      : 0;

  const load = useCallback(async () => {
    if (!selectedVenueId) return;
    const [{ data: current }, { data: items }] = await Promise.all([
      api.get("/cash/shifts/current", { params: { venueId: selectedVenueId } }),
      api.get("/cash/catalog", { params: { venueId: selectedVenueId } }),
    ]);
    setShift(current);
    setCatalog(items ?? []);
    if (current?.id) {
      try {
        const { data: report } = await api.get(`/cash/shifts/${current.id}/report`);
        setExpected(report.expected);
        setCloseForm((f) => ({
          ...f,
          cash: String(report.expected?.cash ?? ""),
          kaspi: String(report.expected?.kaspi ?? ""),
          halyk: String(report.expected?.halyk ?? ""),
          freedom: String(report.expected?.freedom ?? ""),
        }));
      } catch {
        setExpected(null);
      }
    } else {
      setExpected(null);
    }
  }, [selectedVenueId]);

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Не удалось загрузить кассу"));
  }, [load]);

  useEffect(() => {
    const q = playerQ.trim();
    if (q.length < 2) {
      setPlayerHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      api
        .get("/users/search", { params: { q, limit: 8 } })
        .then(({ data }) => {
          const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          setPlayerHits(
            rows.map((u: any) => ({
              id: String(u.id),
              nickname: String(u.nickname ?? u.name ?? "Игрок"),
              phone: u.phone ? String(u.phone) : undefined,
            })),
          );
        })
        .catch(() => setPlayerHits([]));
    }, 280);
    return () => window.clearTimeout(t);
  }, [playerQ]);

  async function openShift() {
    setError("");
    setBusy(true);
    try {
      await api.post("/cash/shifts/open", {
        venueId: selectedVenueId,
        openingCash: Number(openingCash) || 0,
      });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось открыть смену");
    } finally {
      setBusy(false);
    }
  }

  function addItem(item: CatalogItem) {
    setCart((prev) => {
      const key = item.id;
      const found = prev.find((l) => l.key === key);
      if (found) {
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          itemId: item.id,
          name: item.name,
          qty: 1,
          priceTenge: catalogPrice(item),
          minutes: item.minutes ?? 0,
        },
      ];
    });
  }

  function setQty(key: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function askConfirm() {
    setError("");
    setOk("");
    if (!cart.length) {
      setError("Добавьте товары в чек");
      return;
    }
    if (minutes > 0 && !player) {
      setError("Минуты нужно начислить игроку — найдите аккаунт");
      return;
    }
    if (method === "CASH") {
      const received = Number(cashReceived);
      if (!Number.isFinite(received) || received < total) {
        setError("Укажите полученные наличные не меньше итога");
        return;
      }
    } else if (!receiptChecked) {
      setError("Отметьте «Терминал: Одобрено» / чек пробит");
      return;
    }
    if (lastSaleTotal != null && lastSaleTotal === total) {
      const okDup = window.confirm("Это точно новая оплата? Сумма совпадает с предыдущей.");
      if (!okDup) return;
    }
    setConfirmOpen(true);
  }

  async function conductSale() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/cash/sales", {
        venueId: selectedVenueId,
        userId: player?.id,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          name: l.name,
          qty: l.qty,
          priceTenge: l.priceTenge,
          minutes: l.minutes,
        })),
        payments: [
          {
            method,
            amountTenge: total,
            cashReceived: method === "CASH" ? Number(cashReceived) : undefined,
          },
        ],
        receiptChecked: method === "CASH" ? true : receiptChecked,
      });
      setLastSaleTotal(total);
      setBanner({ saleId: data.id, text: `Оплата проведена · ${data.totalTenge} ₸` });
      setCart([]);
      setCashReceived("");
      setReceiptChecked(false);
      setConfirmOpen(false);
      setOk("Оплата проведена");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Продажа не прошла");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSale(saleId: string, reason = "Ошибочная продажа") {
    setBusy(true);
    setError("");
    try {
      await api.post(`/cash/sales/${saleId}/cancel`, { reason });
      setBanner(null);
      setOk("Продажа отменена");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось отменить");
    } finally {
      setBusy(false);
    }
  }

  async function moveCash() {
    if (!shift?.id) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/cash/shifts/${shift.id}/movements`, {
        type: moveType,
        amount: Number(moveAmount),
        comment: moveComment || undefined,
        article: moveType === "EXPENSE" ? "Расход из кассы" : undefined,
      });
      setMoveAmount("");
      setMoveComment("");
      setOk("Движение по кассе записано");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не записалось");
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!shift?.id) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/cash/shifts/${shift.id}/close`, {
        closingCashActual: Number(closeForm.cash) || 0,
        closingKaspi: Number(closeForm.kaspi) || 0,
        closingHalyk: Number(closeForm.halyk) || 0,
        closingFreedom: Number(closeForm.freedom) || 0,
        closeComment: closeForm.comment || undefined,
      });
      setOk("Смена закрыта");
      setCart([]);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось закрыть смену");
    } finally {
      setBusy(false);
    }
  }

  const sales: any[] = shift?.sales ?? [];

  return (
    <div className="space-y-4 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Касса</h1>
        <p className="mt-1 text-sm text-amber-300">
          Игрок → товары → чек → оплата → «Провести». Оплаченные минуты действуют 24 часа.
        </p>
      </div>
      {error ? <p className="text-sm text-red-400">{String(error)}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
      {banner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success/15 px-4 py-3 text-sm text-success">
          <span>{banner.text}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => cancelSale(banner.saleId, "Отмена сразу после проведения")}
            className="min-h-11 rounded-xl bg-bg-card px-3 text-text-primary"
          >
            Отменить
          </button>
        </div>
      ) : null}

      {!shift ? (
        <div className="rounded-xl bg-bg-secondary p-4">
          <label className="mb-2 block text-sm">Наличные на начало</label>
          <input
            inputMode="numeric"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            className="mb-3 h-12 w-full rounded-xl bg-bg-card px-3 text-base"
          />
          <button
            type="button"
            disabled={busy || !selectedVenueId}
            onClick={openShift}
            className="min-h-12 rounded-xl bg-cyan px-4 font-semibold text-black disabled:opacity-50"
          >
            Открыть смену
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl bg-bg-secondary p-4">
            <p className="font-semibold">Смена №{shift.number} открыта</p>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">1. Игрок</p>
              {player ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-bg-card px-3 py-2">
                  <div>
                    <p className="font-medium">{player.nickname}</p>
                    {player.phone ? <p className="text-xs text-text-secondary">{player.phone}</p> : null}
                  </div>
                  <button type="button" className="text-sm text-cyan" onClick={() => setPlayer(null)}>
                    Сменить
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    value={playerQ}
                    onChange={(e) => setPlayerQ(e.target.value)}
                    placeholder="Ник или телефон"
                    className="h-12 w-full rounded-xl bg-bg-card px-3 text-base"
                  />
                  {playerHits.length > 0 ? (
                    <ul className="overflow-hidden rounded-xl border border-white/10 bg-bg-card">
                      {playerHits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-white/5"
                            onClick={() => {
                              setPlayer(hit);
                              setPlayerQ("");
                              setPlayerHits([]);
                            }}
                          >
                            <span className="text-sm font-medium">{hit.nickname}</span>
                            {hit.phone ? <span className="text-xs text-text-secondary">{hit.phone}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">2. Товары</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {catalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="rounded-xl bg-bg-card p-3 text-left hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold leading-snug">{item.name}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {catalogPrice(item)} ₸
                      {item.minutes ? ` · ${item.minutes} мин` : ""}
                      {isAlmatyWeekend() ? " · выходной" : ""}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl bg-bg-secondary p-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">3. Чек</p>
              {cart.length === 0 ? (
                <p className="text-sm text-text-secondary">Пусто — нажмите плитку товара</p>
              ) : (
                <ul className="space-y-2">
                  {cart.map((line) => (
                    <li key={line.key} className="flex items-center justify-between gap-2 rounded-xl bg-bg-card px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.name}</p>
                        <p className="text-xs text-text-secondary">
                          {line.priceTenge} ₸
                          {line.minutes ? ` · ${line.minutes} мин` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary"
                          onClick={() => setQty(line.key, line.qty - 1)}
                        >
                          −
                        </button>
                        <span className="w-6 text-center tabular-nums">{line.qty}</span>
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary"
                          onClick={() => setQty(line.key, line.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-lg font-bold tabular-nums">{total} ₸</p>
              {minutes > 0 ? (
                <p className="text-sm text-cyan">+{minutes} мин игроку, действуют 24 ч</p>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">4. Оплата</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`min-h-11 rounded-xl px-3 ${method === m ? "bg-cyan text-black" : "bg-bg-card"}`}
                  >
                    {payMethodLabel(m)}
                  </button>
                ))}
              </div>
              {method === "CASH" ? (
                <label className="mb-3 block text-sm">
                  Получено наличными
                  <input
                    inputMode="numeric"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3 text-base"
                  />
                  {cashReceived !== "" ? (
                    <span className="mt-1 block text-xs text-text-secondary">Сдача {change} ₸</span>
                  ) : null}
                </label>
              ) : (
                <label className="mb-3 flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={receiptChecked}
                    onChange={(e) => setReceiptChecked(e.target.checked)}
                    className="h-5 w-5"
                  />
                  Терминал: Одобрено / чек Веб-кассы пробит
                </label>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={askConfirm}
                className="min-h-12 w-full rounded-xl bg-cyan font-semibold text-black disabled:opacity-50"
              >
                Провести
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-xl bg-bg-secondary p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold">Продажи смены</h2>
            {sales.length === 0 ? (
              <p className="text-sm text-text-secondary">Пока нет</p>
            ) : (
              <ul className="space-y-2">
                {[...sales].reverse().map((sale) => (
                  <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">
                        №{sale.number} · {sale.totalTenge} ₸ · {saleStatusLabel(sale.status)}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {sale.lines?.map((l: any) => `${l.name}×${l.qty}`).join(", ")}
                        {" · "}
                        {sale.payments?.map((p: any) => `${payMethodLabel(p.method)} ${p.amountTenge}`).join(", ")}
                      </p>
                    </div>
                    {sale.status !== "CANCELLED" ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-11 rounded-xl bg-bg-secondary px-3"
                        onClick={() => {
                          const reason = window.prompt("Причина отмены", "Ошибка кассира");
                          if (!reason?.trim()) return;
                          void cancelSale(sale.id, reason.trim());
                        }}
                      >
                        Отменить
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted">{sale.cancelReason || "Отменена"}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl bg-bg-secondary p-4">
            <h2 className="text-lg font-semibold">Деньги в кассе</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["IN", "Внести"],
                  ["OUT", "Изъять"],
                  ["EXPENSE", "Расход"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMoveType(value)}
                  className={`min-h-11 rounded-xl px-3 ${moveType === value ? "bg-cyan text-black" : "bg-bg-card"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              inputMode="numeric"
              placeholder="Сумма"
              value={moveAmount}
              onChange={(e) => setMoveAmount(e.target.value)}
              className="h-12 w-full rounded-xl bg-bg-card px-3"
            />
            <input
              placeholder="Комментарий"
              value={moveComment}
              onChange={(e) => setMoveComment(e.target.value)}
              className="h-12 w-full rounded-xl bg-bg-card px-3"
            />
            <button
              type="button"
              disabled={busy || !moveAmount}
              onClick={moveCash}
              className="min-h-12 rounded-xl bg-bg-card px-4 font-semibold disabled:opacity-50"
            >
              Записать
            </button>
          </section>

          <section className="space-y-3 rounded-xl bg-bg-secondary p-4">
            <h2 className="text-lg font-semibold">Закрытие смены</h2>
            {expected ? (
              <div className="overflow-x-auto text-sm">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr className="text-left text-text-secondary">
                      <th className="py-1">Способ</th>
                      <th>По CRM</th>
                      <th>По факту</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["cash", "Наличные", closeForm.cash, (v: string) => setCloseForm({ ...closeForm, cash: v })],
                        ["kaspi", "Kaspi", closeForm.kaspi, (v: string) => setCloseForm({ ...closeForm, kaspi: v })],
                        ["halyk", "Halyk", closeForm.halyk, (v: string) => setCloseForm({ ...closeForm, halyk: v })],
                        ["freedom", "Freedom", closeForm.freedom, (v: string) => setCloseForm({ ...closeForm, freedom: v })],
                      ] as const
                    ).map(([key, label, value, setValue]) => (
                      <tr key={key} className="border-t border-white/10">
                        <td className="py-2">{label}</td>
                        <td className="tabular-nums">{expected[key] ?? 0}</td>
                        <td>
                          <input
                            inputMode="numeric"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="h-10 w-28 rounded-lg bg-bg-card px-2"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <input
              placeholder="Комментарий при расхождении"
              value={closeForm.comment}
              onChange={(e) => setCloseForm({ ...closeForm, comment: e.target.value })}
              className="h-12 w-full rounded-xl bg-bg-card px-3"
            />
            <button
              type="button"
              disabled={busy}
              onClick={closeShift}
              className="min-h-12 rounded-xl bg-cyan px-4 font-semibold text-black disabled:opacity-50"
            >
              Закрыть смену
            </button>
          </section>
        </div>
      )}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-[#141C26] p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Подтвердите оплату</h3>
            <p className="mt-2 text-sm text-text-secondary">
              {cart.map((l) => `${l.name} × ${l.qty}`).join(", ")}
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums">{total} ₸</p>
            <p className="text-sm text-text-secondary">
              {payMethodLabel(method)}
              {player ? ` · ${player.nickname}` : ""}
              {minutes ? ` · +${minutes} мин` : ""}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl bg-bg-card"
                onClick={() => setConfirmOpen(false)}
              >
                Назад
              </button>
              <button
                type="button"
                disabled={busy}
                className="min-h-12 flex-1 rounded-xl bg-cyan font-semibold text-black disabled:opacity-50"
                onClick={conductSale}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
