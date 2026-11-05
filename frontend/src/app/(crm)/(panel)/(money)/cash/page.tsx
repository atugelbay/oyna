"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { CATALOG_CATEGORY_LABEL, payMethodLabel, saleStatusLabel } from "@/lib/crm-labels";
import { formatTenge } from "@/lib/money";
import { isAlmatyWeekend } from "@/lib/almaty";

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  priceTenge: number;
  priceWeekendTenge?: number | null;
  minutes?: number | null;
};

type LineKind = "ITEM" | "CERTIFICATE" | "BOOKING";

type CartLine = {
  key: string;
  kind: LineKind;
  itemId?: string;
  bookingId?: string;
  name: string;
  qty: number;
  priceTenge: number;
  minutes: number;
  category: string;
};

type CardMethod = "KASPI" | "HALYK" | "FREEDOM";
type PayMode = "CASH" | CardMethod | "MIXED";

type PlayerHit = { id: string; nickname: string; phone?: string };

type CashBooking = {
  id: string;
  startsAt: string;
  contactName: string;
  contactPhone: string;
  packageName: string;
  people: number;
  amountTenge: number;
  paidTenge: number;
  due: { kind: "PREPAY" | "REST"; label: string; amount: number; remaining: number };
};

type ShiftSummary = {
  sales: number;
  revenue: number;
  refunds: number;
  cancelled: number;
  minutes: number;
  byMethod: Record<string, number>;
  cashIn: number;
  cashOut: number;
  expenses: number;
};

const CARD_METHODS: CardMethod[] = ["KASPI", "HALYK", "FREEDOM"];
const PAY_MODES: PayMode[] = ["CASH", "KASPI", "HALYK", "FREEDOM", "MIXED"];

/** Порядок групп плиток: игра, акции, ДР и тимбилдинг, товары, бартер */
const CATEGORY_ORDER = ["GAMES", "PROMO", "PACKAGES", "WATER", "OTHER", "BARTER"];

function catalogPrice(item: CatalogItem) {
  if (isAlmatyWeekend() && item.priceWeekendTenge != null) return item.priceWeekendTenge;
  return item.priceTenge;
}

function toInt(value: string) {
  const n = Number(String(value).replace(/\s/g, ""));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export default function CashPage() {
  const { selectedVenueId } = useCrmVenue();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";

  const [shift, setShift] = useState<any>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [openingCash, setOpeningCash] = useState("0");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  // Кому продаём
  const [playerQ, setPlayerQ] = useState("");
  const [playerHits, setPlayerHits] = useState<PlayerHit[]>([]);
  const [players, setPlayers] = useState<PlayerHit[]>([]);
  const [guest, setGuest] = useState(false);

  // Чек
  const [cart, setCart] = useState<CartLine[]>([]);
  const [barterComment, setBarterComment] = useState("");

  // Брони и сертификаты
  const [bookingQ, setBookingQ] = useState("");
  const [bookings, setBookings] = useState<CashBooking[]>([]);
  const [certCode, setCertCode] = useState("");

  // Оплата
  const [payMode, setPayMode] = useState<PayMode>("CASH");
  const [mixedCard, setMixedCard] = useState<CardMethod>("KASPI");
  const [cashPart, setCashPart] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [terminalOk, setTerminalOk] = useState(false);
  const [receiptChecked, setReceiptChecked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ saleId: string; text: string; codes?: string[] } | null>(null);

  // Смена
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [expected, setExpected] = useState<any>(null);
  const [shiftBarter, setShiftBarter] = useState<{ sales: number; minutes: number } | null>(null);
  const [unchecked, setUnchecked] = useState(0);
  const [xOpen, setXOpen] = useState(false);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [moveType, setMoveType] = useState<"IN" | "OUT" | "EXPENSE">("OUT");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveComment, setMoveComment] = useState("");
  const [closeForm, setCloseForm] = useState({ cash: "", kaspi: "", halyk: "", freedom: "", comment: "" });

  // Отмена и возврат
  const [cancelFor, setCancelFor] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundFor, setRefundFor] = useState<any | null>(null);
  const [refundForm, setRefundForm] = useState({ amount: "", reason: "", method: "CASH" });

  const total = useMemo(() => cart.reduce((s, l) => s + l.priceTenge * l.qty, 0), [cart]);
  const gameMinutes = useMemo(
    () => cart.filter((l) => l.kind === "ITEM").reduce((s, l) => s + l.minutes * l.qty, 0),
    [cart],
  );
  const isBarter = cart.length > 0 && cart.every((l) => l.category === "BARTER");
  const perPlayer = players.length ? gameMinutes / players.length : 0;
  const hasCard = payMode !== "CASH" && total > 0 && !isBarter;
  const cashDue = payMode === "CASH" ? total : payMode === "MIXED" ? toInt(cashPart) || 0 : 0;
  const change = cashReceived !== "" ? Math.max(0, toInt(cashReceived) - cashDue) : 0;

  const catalogGroups = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const item of catalog) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    const rank = (c: string) => {
      const i = CATEGORY_ORDER.indexOf(c);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    return [...groups.entries()]
      .filter(([c]) => c !== "CERTIFICATE")
      .sort(([a], [b]) => rank(a) - rank(b));
  }, [catalog]);

  /** Сертификат — на минуты игровой плитки по её цене */
  const certificateTiles = useMemo(
    () => catalog.filter((i) => i.category === "GAMES" && (i.minutes ?? 0) > 0),
    [catalog],
  );

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
        setSummary(report.summary ?? null);
        setShiftBarter(report.barter ?? null);
        setUnchecked(report.uncheckedReceipts ?? 0);
        setCloseForm((f) => ({
          ...f,
          cash: String(report.expected?.cash ?? ""),
          kaspi: String(report.expected?.kaspi ?? ""),
          halyk: String(report.expected?.halyk ?? ""),
          freedom: String(report.expected?.freedom ?? ""),
        }));
      } catch {
        setExpected(null);
        setSummary(null);
        setShiftBarter(null);
      }
    } else {
      setExpected(null);
      setSummary(null);
      setShiftBarter(null);
    }
  }, [selectedVenueId]);

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Не удалось загрузить кассу"));
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get("/cash/alerts/overdue-shifts", { params: { venueId: selectedVenueId || undefined } })
      .then(({ data }) => setOverdue(Array.isArray(data) ? data : []))
      .catch(() => setOverdue([]));
  }, [isAdmin, selectedVenueId, shift?.id]);

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

  useEffect(() => {
    if (!selectedVenueId || !shift?.id) return;
    const t = window.setTimeout(() => {
      api
        .get("/cash/bookings", { params: { venueId: selectedVenueId, q: bookingQ.trim() || undefined } })
        .then(({ data }) => setBookings(Array.isArray(data) ? data : []))
        .catch(() => setBookings([]));
    }, 280);
    return () => window.clearTimeout(t);
  }, [bookingQ, selectedVenueId, shift?.id]);

  // Переход с главной или из карточки: /cash?player=<id> или /cash?booking=<id>
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillDone.current || !shift?.id || !selectedVenueId) return;
    prefillDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const playerId = params.get("player");
    const bookingId = params.get("booking");
    if (playerId) {
      api
        .get(`/users/${playerId}`)
        .then(({ data }) =>
          addPlayer({ id: String(data.id), nickname: String(data.nickname ?? data.name ?? "Игрок"), phone: data.phone }),
        )
        .catch(() => setError("Игрок не найден"));
    }
    if (bookingId) {
      api
        .get("/cash/bookings", { params: { venueId: selectedVenueId } })
        .then(({ data }) => {
          const found = (Array.isArray(data) ? data : []).find((b: CashBooking) => b.id === bookingId);
          if (found) addBooking(found);
          else setError("По этой брони нечего оплачивать");
        })
        .catch(() => setError("Бронь не загрузилась"));
    }
    if (playerId || bookingId) window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift?.id, selectedVenueId]);

  function resetSale() {
    setCart([]);
    setPlayers([]);
    setGuest(false);
    setBarterComment("");
    setCashPart("");
    setCashReceived("");
    setTerminalOk(false);
    setReceiptChecked(false);
  }

  async function openShift() {
    setError("");
    setBusy(true);
    try {
      await api.post("/cash/shifts/open", {
        venueId: selectedVenueId,
        openingCash: toInt(openingCash) || 0,
      });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось открыть смену");
    } finally {
      setBusy(false);
    }
  }

  function addPlayer(hit: PlayerHit) {
    setGuest(false);
    setPlayers((prev) => (prev.some((p) => p.id === hit.id) ? prev : [...prev, hit]));
    setPlayerQ("");
    setPlayerHits([]);
  }

  function toggleGuest() {
    setGuest((g) => !g);
    setPlayers([]);
    setPlayerQ("");
    setPlayerHits([]);
  }

  function pushLine(line: Omit<CartLine, "qty">, step = 1) {
    const barter = line.category === "BARTER";
    if (cart.length > 0 && cart.some((l) => l.category === "BARTER") !== barter) {
      setError("Бартер проводится отдельным чеком");
      return;
    }
    setError("");
    setCart((prev) => {
      const found = prev.find((l) => l.key === line.key);
      if (found) return prev.map((l) => (l.key === line.key ? { ...l, qty: l.qty + step } : l));
      return [...prev, { ...line, qty: step }];
    });
  }

  function addItem(item: CatalogItem) {
    const minutes = item.minutes ?? 0;
    // Несколько игроков: плитка с минутами добавляется на каждого
    const step = minutes > 0 && players.length > 1 ? players.length : 1;
    pushLine(
      {
        key: `ITEM:${item.id}`,
        kind: "ITEM",
        itemId: item.id,
        name: item.name,
        priceTenge: catalogPrice(item),
        minutes,
        category: item.category,
      },
      step,
    );
  }

  function addCertificate(item: CatalogItem) {
    pushLine({
      key: `CERT:${item.id}`,
      kind: "CERTIFICATE",
      itemId: item.id,
      name: `Сертификат ${item.minutes} мин`,
      priceTenge: catalogPrice(item),
      minutes: item.minutes ?? 0,
      category: "CERTIFICATE",
    });
  }

  function addBooking(b: CashBooking) {
    if (cart.some((l) => l.kind === "BOOKING")) {
      setError("Одна бронь на чек");
      return;
    }
    pushLine({
      key: `BOOKING:${b.id}`,
      kind: "BOOKING",
      bookingId: b.id,
      name: `${b.due.label} брони · ${b.contactName}`,
      priceTenge: b.due.amount,
      minutes: 0,
      category: "BOOKING",
    });
  }

  function setQty(key: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)).filter((l) => l.qty > 0));
  }

  function setLinePrice(key: string, value: string) {
    const price = toInt(value);
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, priceTenge: Number.isFinite(price) ? price : 0 } : l)));
  }

  async function activateCertificate() {
    setError("");
    setOk("");
    if (!certCode.trim()) return setError("Введите код сертификата");
    if (players.length !== 1) return setError("Для активации выберите одного игрока");
    setBusy(true);
    try {
      const { data } = await api.post("/certificates/activate", { code: certCode.trim(), userId: players[0].id });
      setOk(`Сертификат активирован: +${data.minutes ?? ""} мин игроку ${players[0].nickname}, действуют 24 ч`);
      setCertCode("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Сертификат не активирован");
    } finally {
      setBusy(false);
    }
  }

  function askConfirm() {
    setError("");
    setOk("");
    if (!cart.length) return setError("Добавьте товары в чек");
    if (gameMinutes > 0 && !guest && players.length === 0) {
      return setError("Выберите игрока или нажмите «Гость»");
    }
    if (gameMinutes > 0 && players.length > 0) {
      if (gameMinutes % players.length !== 0) {
        return setError(`Минуты не делятся поровну на ${players.length} игроков: добавьте плитку на каждого`);
      }
      if ((gameMinutes / players.length) % 10 !== 0) return setError("Каждому игроку — кратно 10 минутам");
    }
    if (isBarter) {
      if (!barterComment.trim()) return setError("Бартер: напишите, кто и по какому договору");
    } else if (total > 0) {
      if (payMode === "MIXED") {
        const part = toInt(cashPart);
        if (!Number.isFinite(part) || part < 1 || part >= total) {
          return setError("Смешанная оплата: наличными — от 1 ₸ и меньше итога");
        }
      }
      if (payMode === "CASH" || payMode === "MIXED") {
        if (!Number.isFinite(toInt(cashReceived)) || toInt(cashReceived) < cashDue) {
          return setError("Укажите полученные наличные — не меньше суммы наличными");
        }
      }
      if (hasCard && !terminalOk) return setError("Отметьте «Терминал: Одобрено»");
    }
    if (lastSaleTotal != null && lastSaleTotal === total && total > 0) {
      const okDup = window.confirm("Это точно новая оплата? Сумма совпадает с предыдущей.");
      if (!okDup) return;
    }
    setConfirmOpen(true);
  }

  function buildPayments() {
    if (isBarter && total === 0) return [];
    if (payMode === "CASH") return [{ method: "CASH", amountTenge: total, cashReceived: toInt(cashReceived) }];
    if (payMode === "MIXED") {
      const part = toInt(cashPart);
      return [
        { method: "CASH", amountTenge: part, cashReceived: toInt(cashReceived) },
        { method: mixedCard, amountTenge: total - part },
      ];
    }
    return [{ method: payMode, amountTenge: total }];
  }

  async function conductSale() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/cash/sales", {
        venueId: selectedVenueId,
        userIds: players.map((p) => p.id),
        guest: guest || undefined,
        lines: cart.map((l) => ({
          kind: l.kind,
          itemId: l.itemId,
          bookingId: l.bookingId,
          name: l.name,
          qty: l.qty,
          priceTenge: l.priceTenge,
          minutes: l.minutes,
        })),
        payments: buildPayments(),
        receiptChecked: isBarter ? true : receiptChecked,
        comment: isBarter ? barterComment.trim() : undefined,
      });
      setLastSaleTotal(total);
      const codes = (data.certificates ?? []).map((c: any) => `${c.code} (${c.minutes} мин)`);
      const who =
        data.minutesPerPlayer && players.length
          ? ` · ${players.map((p) => p.nickname).join(", ")}: +${data.minutesPerPlayer} мин каждому`
          : guest
            ? " · Гость"
            : "";
      setBanner({
        saleId: data.id,
        text: isBarter
          ? `Бартер проведён · ${data.minutesCredited} мин${who}`
          : `Оплата проведена · ${formatTenge(data.totalTenge)}${who}${receiptChecked ? "" : " · без чека"}`,
        codes,
      });
      resetSale();
      setConfirmOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Продажа не прошла");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSale(saleId: string, reason: string) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/cash/sales/${saleId}/cancel`, { reason });
      setBanner(null);
      setCancelFor(null);
      setCancelReason("");
      setOk("Продажа отменена, минуты сняты");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось отменить");
    } finally {
      setBusy(false);
    }
  }

  async function refundSale() {
    if (!refundFor) return;
    const amount = toInt(refundForm.amount);
    if (!Number.isFinite(amount) || amount < 1) return setError("Укажите сумму возврата");
    if (!refundForm.reason.trim()) return setError("Укажите причину возврата");
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/cash/sales/${refundFor.id}/refund`, {
        amountTenge: amount,
        reason: refundForm.reason.trim(),
        method: refundForm.method,
      });
      setOk(`Возврат ${formatTenge(amount)} проведён, снято ${data.removedMinutes} мин`);
      setRefundFor(null);
      setRefundForm({ amount: "", reason: "", method: "CASH" });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Возврат не прошёл");
    } finally {
      setBusy(false);
    }
  }

  async function moveCash() {
    if (!shift?.id) return;
    if (!moveComment.trim()) {
      setError("Напишите комментарий: откуда или куда деньги");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post(`/cash/shifts/${shift.id}/movements`, {
        type: moveType,
        amount: toInt(moveAmount),
        comment: moveComment.trim(),
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
        closingCashActual: toInt(closeForm.cash) || 0,
        closingKaspi: toInt(closeForm.kaspi) || 0,
        closingHalyk: toInt(closeForm.halyk) || 0,
        closingFreedom: toInt(closeForm.freedom) || 0,
        closeComment: closeForm.comment || undefined,
      });
      setOk("Смена закрыта");
      resetSale();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось закрыть смену");
    } finally {
      setBusy(false);
    }
  }

  const sales: any[] = shift?.sales ?? [];
  const ownShift = !!shift && (isAdmin || shift.openedById === user?.id);

  return (
    <div className="space-y-4 text-text-primary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Касса</h1>
          <p className="mt-1 text-sm text-amber-300">
            Кому → товары → чек → оплата → «Провести». Оплаченные минуты действуют 24 часа.
          </p>
        </div>
        {shift ? (
          <button type="button" onClick={() => setXOpen(true)} className="min-h-11 rounded-xl bg-bg-secondary px-4 text-sm">
            Итог сейчас
          </button>
        ) : null}
      </div>

      {overdue.length > 0 ? (
        <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {overdue.map((s) => (
            <p key={s.shiftId}>
              Смена №{s.number} ({s.operatorName}) не закрыта к 23:00 — открыта{" "}
              {new Date(s.openedAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}
            </p>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-400">{String(error)}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
      {banner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success/15 px-4 py-3 text-sm text-success">
          <div>
            <p>{banner.text}</p>
            {banner.codes?.length ? (
              <p className="mt-1 font-semibold text-text-primary">Коды сертификатов: {banner.codes.join(", ")}</p>
            ) : null}
          </div>
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
          <p className="mb-3 text-sm text-red-300">Смена не открыта — продажи невозможны.</p>
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
      ) : !ownShift ? (
        <div className="rounded-xl bg-bg-secondary p-4 text-sm">
          <p className="font-semibold">Смена №{shift.number} открыта другим сотрудником.</p>
          <p className="mt-1 text-text-secondary">
            Смена принадлежит оператору. Чтобы продавать, её нужно закрыть и открыть свою.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl bg-bg-secondary p-4">
            <p className="font-semibold">Смена №{shift.number} открыта</p>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">1. Кому</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {players.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-bg-card px-3 py-1 text-sm">
                    {p.nickname}
                    <button
                      type="button"
                      aria-label={`Убрать ${p.nickname}`}
                      className="text-text-secondary hover:text-text-primary"
                      onClick={() => setPlayers((prev) => prev.filter((x) => x.id !== p.id))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {guest ? <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-200">Гость — без минут</span> : null}
              </div>
              <div className="flex gap-2">
                <input
                  value={playerQ}
                  disabled={guest}
                  onChange={(e) => setPlayerQ(e.target.value)}
                  placeholder={players.length ? "Добавить ещё игрока" : "Ник или телефон"}
                  className="h-12 min-w-0 flex-1 rounded-xl bg-bg-card px-3 text-base disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={toggleGuest}
                  className={`min-h-12 rounded-xl px-4 text-sm ${guest ? "bg-amber-400 text-black" : "bg-bg-card"}`}
                >
                  Гость
                </button>
              </div>
              {playerHits.length > 0 ? (
                <ul className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-bg-card">
                  {playerHits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-white/5"
                        onClick={() => addPlayer(hit)}
                      >
                        <span className="text-sm font-medium">{hit.nickname}</span>
                        {hit.phone ? <span className="text-xs text-text-secondary">{hit.phone}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {players.length > 1 ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Плитка с минутами добавится на каждого ({players.length} шт.), минуты разделятся поровну
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">2. Товары</p>
              {catalogGroups.map(([category, items]) => (
                <div key={category}>
                  <p className="mb-1 text-xs text-text-secondary">{CATALOG_CATEGORY_LABEL[category] ?? category}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addItem(item)}
                        className="rounded-xl bg-bg-card p-3 text-left hover:bg-white/10"
                      >
                        <p className="text-sm font-semibold leading-snug">{item.name}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {item.category === "BARTER" ? "по договору" : formatTenge(catalogPrice(item))}
                          {item.minutes ? ` · ${item.minutes} мин` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <p className="mb-1 text-xs text-text-secondary">Брони — предоплата и доплата</p>
                <input
                  value={bookingQ}
                  onChange={(e) => setBookingQ(e.target.value)}
                  placeholder="Телефон или имя из брони"
                  className="mb-2 h-11 w-full rounded-xl bg-bg-card px-3 text-sm"
                />
                {bookings.length === 0 ? (
                  <p className="text-xs text-text-muted">Нет броней с остатком к оплате</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.slice(0, 5).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => addBooking(b)}
                        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-card px-3 py-2 text-left text-sm hover:bg-white/10"
                      >
                        <span>
                          {new Date(b.startsAt).toLocaleString("ru-RU", {
                            timeZone: "Asia/Almaty",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" · "}
                          {b.contactName} · {b.packageName} · {b.people} чел
                        </span>
                        <span className="font-semibold">
                          {b.due.label} {formatTenge(b.due.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs text-text-secondary">Сертификаты</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {certificateTiles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addCertificate(item)}
                      className="rounded-xl bg-bg-card p-3 text-left hover:bg-white/10"
                    >
                      <p className="text-sm font-semibold leading-snug">Сертификат {item.minutes} мин</p>
                      <p className="mt-1 text-xs text-text-secondary">{formatTenge(catalogPrice(item))} · код после оплаты</p>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={certCode}
                    onChange={(e) => setCertCode(e.target.value.toUpperCase())}
                    placeholder="Код для активации"
                    className="h-11 min-w-0 flex-1 rounded-xl bg-bg-card px-3 text-sm uppercase"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={activateCertificate}
                    className="min-h-11 rounded-xl bg-bg-card px-3 text-sm disabled:opacity-50"
                  >
                    Активировать
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-muted">Минуты получит выбранный игрок, срок 24 ч с активации</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl bg-bg-secondary p-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">3. Чек</p>
              {cart.length === 0 ? (
                <p className="text-sm text-text-secondary">Пусто — нажмите плитку</p>
              ) : (
                <ul className="space-y-2">
                  {cart.map((line) => (
                    <li key={line.key} className="flex items-center justify-between gap-2 rounded-xl bg-bg-card px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.name}</p>
                        {isAdmin && line.category !== "BARTER" ? (
                          <label className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                            Цена
                            <input
                              inputMode="numeric"
                              value={String(line.priceTenge)}
                              onChange={(e) => setLinePrice(line.key, e.target.value)}
                              className="h-8 w-24 rounded-lg bg-bg-secondary px-2 text-text-primary"
                            />
                            ₸{line.minutes && line.kind === "ITEM" ? ` · ${line.minutes} мин` : ""}
                          </label>
                        ) : (
                          <p className="text-xs text-text-secondary">
                            {line.category === "BARTER" ? "бартер" : formatTenge(line.priceTenge)}
                            {line.minutes ? ` · ${line.minutes} мин` : ""}
                          </p>
                        )}
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
                          disabled={line.kind === "BOOKING"}
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary disabled:opacity-30"
                          onClick={() => setQty(line.key, line.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-lg font-bold tabular-nums">{isBarter ? "Бартер" : formatTenge(total)}</p>
              {gameMinutes > 0 ? (
                <p className="text-sm text-cyan">
                  {guest
                    ? "Гость: минуты не начисляются"
                    : players.length > 1
                      ? `+${Number.isInteger(perPlayer) ? perPlayer : "?"} мин каждому (${players.length} игрока), действуют 24 ч`
                      : `+${gameMinutes} мин игроку, действуют 24 ч`}
                </p>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">4. Оплата</p>
              {isBarter ? (
                <label className="mb-3 block text-sm">
                  Кто / по какому договору
                  <input
                    value={barterComment}
                    onChange={(e) => setBarterComment(e.target.value)}
                    placeholder="Например: RC Race Lab, договор №3 от 01.10"
                    className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3 text-base"
                  />
                  <span className="mt-1 block text-xs text-text-secondary">Без денег, в выручку не входит</span>
                </label>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {PAY_MODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setPayMode(m);
                          setTerminalOk(false);
                        }}
                        className={`min-h-11 rounded-xl px-3 ${payMode === m ? "bg-cyan text-black" : "bg-bg-card"}`}
                      >
                        {m === "MIXED" ? "Наличные + карта" : payMethodLabel(m)}
                      </button>
                    ))}
                  </div>
                  {payMode === "MIXED" ? (
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                      <label className="block text-sm">
                        Наличными
                        <input
                          inputMode="numeric"
                          value={cashPart}
                          onChange={(e) => setCashPart(e.target.value)}
                          className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3 text-base"
                        />
                      </label>
                      <label className="block text-sm">
                        Картой — {formatTenge(Math.max(0, total - (toInt(cashPart) || 0)))}
                        <select
                          value={mixedCard}
                          onChange={(e) => setMixedCard(e.target.value as CardMethod)}
                          className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3 text-base"
                        >
                          {CARD_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {payMethodLabel(m)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                  {payMode === "CASH" || payMode === "MIXED" ? (
                    <label className="mb-3 block text-sm">
                      Получено наличными
                      <input
                        inputMode="numeric"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3 text-base"
                      />
                      {cashReceived !== "" ? (
                        <span className="mt-1 block text-sm font-semibold text-text-primary">Сдача {formatTenge(change)}</span>
                      ) : null}
                    </label>
                  ) : null}
                  {hasCard ? (
                    <label className="mb-2 flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={terminalOk}
                        onChange={(e) => setTerminalOk(e.target.checked)}
                        className="h-5 w-5"
                      />
                      Терминал: Одобрено
                    </label>
                  ) : null}
                  <label className="mb-3 flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={receiptChecked}
                      onChange={(e) => setReceiptChecked(e.target.checked)}
                      className="h-5 w-5"
                    />
                    Чек Веб-кассы пробит
                    {!receiptChecked ? <span className="text-xs text-amber-300">— иначе в отчёте «без чека»</span> : null}
                  </label>
                </>
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
                        №{sale.number} ·{" "}
                        {sale.isBarter ? `Бартер · ${sale.minutesCredited} мин` : formatTenge(sale.totalTenge)} ·{" "}
                        {saleStatusLabel(sale.status)}
                        {sale.refundTenge > 0 ? ` · возврат ${formatTenge(sale.refundTenge)}` : ""}
                        {sale.status === "COMPLETED" && !sale.isBarter && !sale.receiptChecked ? " · без чека" : ""}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {sale.isGuest ? "Гость · " : sale.userIds?.length > 1 ? `${sale.userIds.length} игрока · ` : ""}
                        {sale.lines?.map((l: any) => `${l.name}×${l.qty}`).join(", ")}
                        {" · "}
                        {sale.isBarter
                          ? sale.comment || "Бартер"
                          : sale.payments?.map((p: any) => `${payMethodLabel(p.method)} ${formatTenge(p.amountTenge)}`).join(", ")}
                      </p>
                    </div>
                    {sale.status !== "CANCELLED" ? (
                      <div className="flex gap-2">
                        {sale.refundTenge === 0 ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="min-h-11 rounded-xl bg-bg-secondary px-3"
                            onClick={() => {
                              setCancelFor(sale);
                              setCancelReason("");
                            }}
                          >
                            Отменить
                          </button>
                        ) : null}
                        {isAdmin && !sale.isBarter && sale.totalTenge > sale.refundTenge ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="min-h-11 rounded-xl bg-bg-secondary px-3"
                            onClick={() => {
                              setRefundFor(sale);
                              setRefundForm({ amount: "", reason: "", method: "CASH" });
                            }}
                          >
                            Возврат
                          </button>
                        ) : null}
                      </div>
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
              placeholder="Комментарий (обязательно): откуда или куда деньги"
              value={moveComment}
              onChange={(e) => setMoveComment(e.target.value)}
              className="h-12 w-full rounded-xl bg-bg-card px-3"
            />
            <button
              type="button"
              disabled={busy || !moveAmount || !moveComment.trim()}
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
                        ["cash", "Наличные"],
                        ["kaspi", "Kaspi"],
                        ["halyk", "Halyk"],
                        ["freedom", "Freedom"],
                      ] as const
                    ).map(([key, label]) => (
                      <tr key={key} className="border-t border-white/10">
                        <td className="py-2">{label}</td>
                        <td className="tabular-nums">{formatTenge(expected[key] ?? 0)}</td>
                        <td>
                          <input
                            inputMode="numeric"
                            value={closeForm[key]}
                            onChange={(e) => setCloseForm({ ...closeForm, [key]: e.target.value })}
                            className="h-10 w-28 rounded-lg bg-bg-card px-2"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {unchecked > 0 ? <p className="text-sm text-amber-300">Без чека Веб-кассы: {unchecked}</p> : null}
            {shiftBarter && shiftBarter.sales > 0 ? (
              <p className="text-sm text-text-secondary">
                Бартер: {shiftBarter.sales} продаж, {shiftBarter.minutes} минут
              </p>
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
        <Modal onClose={() => setConfirmOpen(false)} title="Подтвердите оплату">
          <p className="mt-2 text-sm text-text-secondary">{cart.map((l) => `${l.name} × ${l.qty}`).join(", ")}</p>
          <p className="mt-3 text-2xl font-bold tabular-nums">{isBarter ? "Бартер" : formatTenge(total)}</p>
          <p className="text-sm text-text-secondary">
            {isBarter
              ? barterComment
              : buildPayments()
                  .map((p) => `${payMethodLabel(p.method)} ${formatTenge(p.amountTenge)}`)
                  .join(" + ")}
          </p>
          <p className="text-sm text-text-secondary">
            {guest
              ? "Гость — без минут"
              : players.length
                ? `${players.map((p) => p.nickname).join(", ")}${gameMinutes ? ` · +${perPlayer} мин каждому` : ""}`
                : ""}
          </p>
          {!isBarter && !receiptChecked ? <p className="mt-1 text-sm text-amber-300">Чек Веб-кассы не отмечен</p> : null}
          <div className="mt-5 flex gap-2">
            <button type="button" className="min-h-12 flex-1 rounded-xl bg-bg-card" onClick={() => setConfirmOpen(false)}>
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
        </Modal>
      ) : null}

      {cancelFor ? (
        <Modal onClose={() => setCancelFor(null)} title={`Отмена продажи №${cancelFor.number}`}>
          <p className="mt-2 text-sm text-text-secondary">Минуты по этой продаже снимутся, продажа будет помечена «Отменена».</p>
          <input
            autoFocus
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Причина (обязательно)"
            className="mt-3 h-12 w-full rounded-xl bg-bg-card px-3"
          />
          <div className="mt-4 flex gap-2">
            <button type="button" className="min-h-12 flex-1 rounded-xl bg-bg-card" onClick={() => setCancelFor(null)}>
              Назад
            </button>
            <button
              type="button"
              disabled={busy || !cancelReason.trim()}
              className="min-h-12 flex-1 rounded-xl bg-red-500/80 font-semibold disabled:opacity-50"
              onClick={() => cancelSale(cancelFor.id, cancelReason.trim())}
            >
              Отменить продажу
            </button>
          </div>
        </Modal>
      ) : null}

      {refundFor ? (
        <Modal onClose={() => setRefundFor(null)} title={`Возврат по продаже №${refundFor.number}`}>
          <p className="mt-2 text-sm text-text-secondary">
            Можно вернуть до {formatTenge(refundFor.totalTenge - refundFor.refundTenge)}. Несыгранные минуты снимутся.
          </p>
          <input
            inputMode="numeric"
            value={refundForm.amount}
            onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
            placeholder="Сумма возврата"
            className="mt-3 h-12 w-full rounded-xl bg-bg-card px-3"
          />
          <input
            value={refundForm.reason}
            onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
            placeholder="Причина (обязательно)"
            className="mt-2 h-12 w-full rounded-xl bg-bg-card px-3"
          />
          <select
            value={refundForm.method}
            onChange={(e) => setRefundForm({ ...refundForm, method: e.target.value })}
            className="mt-2 h-12 w-full rounded-xl bg-bg-card px-3"
          >
            {["CASH", ...CARD_METHODS].map((m) => (
              <option key={m} value={m}>
                {payMethodLabel(m)}
              </option>
            ))}
          </select>
          <div className="mt-4 flex gap-2">
            <button type="button" className="min-h-12 flex-1 rounded-xl bg-bg-card" onClick={() => setRefundFor(null)}>
              Назад
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-12 flex-1 rounded-xl bg-cyan font-semibold text-black disabled:opacity-50"
              onClick={refundSale}
            >
              Вернуть
            </button>
          </div>
        </Modal>
      ) : null}

      {xOpen && shift ? (
        <Modal onClose={() => setXOpen(false)} title={`Итог смены №${shift.number} сейчас`}>
          {summary ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>
                Продаж: {summary.sales} · выручка <b>{formatTenge(summary.revenue)}</b>
              </p>
              {summary.refunds > 0 ? <p>Возвраты: {formatTenge(summary.refunds)}</p> : null}
              {summary.cancelled > 0 ? <p>Отменено продаж: {summary.cancelled}</p> : null}
              <p>Начислено минут: {summary.minutes}</p>
              <p className="pt-2 text-text-secondary">По способам оплаты</p>
              {Object.entries(summary.byMethod).map(([m, sum]) => (
                <p key={m}>
                  {payMethodLabel(m)}: {formatTenge(sum)}
                </p>
              ))}
              <p className="pt-2 text-text-secondary">Наличные в кассе</p>
              <p>
                Внесено: {formatTenge(summary.cashIn)} · изъято: {formatTenge(summary.cashOut)} · расходы:{" "}
                {formatTenge(summary.expenses)}
              </p>
              {expected ? (
                <p>
                  Должно быть наличных: <b>{formatTenge(expected.cash)}</b>
                </p>
              ) : null}
              {unchecked > 0 ? <p className="text-amber-300">Без чека Веб-кассы: {unchecked}</p> : null}
              {shiftBarter && shiftBarter.sales > 0 ? (
                <p>
                  Бартер: {shiftBarter.sales} продаж, {shiftBarter.minutes} минут
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">Нет данных</p>
          )}
          <button type="button" className="mt-5 min-h-12 w-full rounded-xl bg-bg-card" onClick={() => setXOpen(false)}>
            Закрыть
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#141C26] p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
