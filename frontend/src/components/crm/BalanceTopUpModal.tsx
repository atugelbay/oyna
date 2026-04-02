"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { settingsService } from "@/services/settings.service";
import { balanceService } from "@/services/balance.service";
import { promosService } from "@/services/promos.service";
import { readApiUserError } from "@/lib/api-error-message";

type BaseTopUpMode = "packages" | "individual";
type PaymentMethod = "cash" | "card" | "kaspi_qr";

type PricePackage = {
  id: string;
  name: string;
  minutes: number;
  costTenge: number;
};

type PromoOption = {
  id: string;
  title: string;
  headline?: string | null;
  type: string;
  reward?: string | null;
  quantity?: string | null;
  dateStart: string;
  dateEnd?: string | null;
  status: string;
};

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePricePackage(raw: unknown, index: number): PricePackage {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const nestedName = obj.name as Record<string, unknown> | string | undefined;
  const rawName =
    typeof nestedName === "string"
      ? nestedName
      : typeof nestedName === "object" && nestedName
        ? (nestedName.title ?? nestedName.name ?? nestedName.code)
        : undefined;
  const nameCandidate = typeof rawName === "string" ? rawName : typeof obj.code === "string" ? obj.code : undefined;
  const minutes = toNumber(obj.minutes ?? obj.durationMinutes ?? obj.duration);
  const costTenge = toNumber(obj.costTenge ?? obj.price ?? obj.amountTenge);

  return {
    id: String(obj.id ?? obj.code ?? `pkg-${index}`),
    name: nameCandidate && nameCandidate.trim() ? nameCandidate : `Пакет ${Math.max(0, minutes)} мин`,
    minutes,
    costTenge,
  };
}

/** Как в форме создания акции: quantity вида «15 мин» */
function parsePromoBonusMinutes(quantity?: string | null): number | null {
  if (!quantity) return null;
  const m = String(quantity).match(/(\d+)\s*мин/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Скидка из quantity/reward вида «10%» */
function parsePromoDiscountPercent(text?: string | null): number | null {
  if (!text) return null;
  const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, n);
}

function promoEffectLabel(p: PromoOption): { kind: "bonus" | "discount" | "unknown"; text: string } {
  const bonus = parsePromoBonusMinutes(p.quantity);
  if (bonus != null) return { kind: "bonus", text: `+${bonus} мин` };
  const pct =
    parsePromoDiscountPercent(p.quantity) ?? parsePromoDiscountPercent(p.reward);
  if (pct != null) return { kind: "discount", text: `−${pct}%` };
  return { kind: "unknown", text: "" };
}

function promoIsActiveNow(p: PromoOption, nowMs = Date.now()): boolean {
  if (p.status !== "ACTIVE") return false;
  const start = new Date(p.dateStart).getTime();
  if (nowMs < start) return false;
  if (p.dateEnd) {
    const end = new Date(p.dateEnd).getTime();
    if (nowMs > end) return false;
  }
  return true;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

interface BalanceTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  playerName?: string;
  venueId?: string | null;
  onSuccess?: () => void;
}

interface BalanceTopUpPanelProps {
  playerId: string;
  playerName?: string;
  /** Площадка: пакеты, акции и транзакция пополнения привязаны к филиалу */
  venueId?: string | null;
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
}

function PromoAddDropdown({
  promosTotal,
  options,
  loading,
  onPick,
}: {
  promosTotal: number;
  options: PromoOption[];
  loading: boolean;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [listPos, setListPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateListPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setListPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setListPos(null);
      return;
    }
    updateListPos();
    window.addEventListener("scroll", updateListPos, true);
    window.addEventListener("resize", updateListPos);
    return () => {
      window.removeEventListener("scroll", updateListPos, true);
      window.removeEventListener("resize", updateListPos);
    };
  }, [open, updateListPos]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) {
    return <p className="text-xs text-text-secondary">Загрузка…</p>;
  }
  if (promosTotal === 0) {
    return <p className="text-xs text-text-secondary">Нет акций</p>;
  }

  const allAdded = options.length === 0;

  const listPortal =
    mounted && open && !allAdded && listPos
      ? createPortal(
          <ul
            ref={listRef}
            role="listbox"
            style={{
              position: "fixed",
              top: listPos.top,
              left: listPos.left,
              width: listPos.width,
              zIndex: 220,
            }}
            className="crm-panel-scroll max-h-56 overflow-y-auto rounded-xl border border-surface-border bg-[#1F2B38] py-1 shadow-xl ring-1 ring-black/30"
          >
            {options.map((p) => {
              const effect = promoEffectLabel(p);
              const tail = effect.text || p.quantity || "";
              return (
                <li key={p.id} role="option">
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-cyan/10"
                    onClick={() => {
                      onPick(p.id);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    {tail ? (
                      <span
                        className={
                          effect.kind === "discount"
                            ? "shrink-0 tabular-nums text-xs text-danger"
                            : "shrink-0 tabular-nums text-xs text-text-muted"
                        }
                      >
                        {tail}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={allAdded}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !allAdded && setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-surface-border bg-bg-primary px-3 text-left text-sm text-text-primary outline-none transition-colors hover:border-cyan/30 focus:border-cyan/40 focus:ring-2 focus:ring-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate text-text-secondary">
          {allAdded ? "Все акции добавлены" : "Добавить акцию…"}
        </span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {listPortal}
    </div>
  );
}

export function BalanceTopUpPanel({
  playerId,
  playerName,
  venueId,
  onSuccess,
  onClose,
  className,
}: BalanceTopUpPanelProps) {
  const [baseMode, setBaseMode] = useState<BaseTopUpMode>("packages");
  const [pricePackages, setPricePackages] = useState<PricePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [promos, setPromos] = useState<PromoOption[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [promosError, setPromosError] = useState<string | null>(null);
  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);
  const [levelBonusEnabled, setLevelBonusEnabled] = useState(false);
  const [individualMinutes, setIndividualMinutes] = useState(15);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function removePromo(id: string) {
    setSelectedPromoIds((prev) => prev.filter((x) => x !== id));
  }

  useEffect(() => {
    setError(null);
    setSubmitting(false);
    setBaseMode("packages");
    setSelectedPromoIds([]);
    setLevelBonusEnabled(false);
    setIndividualMinutes(15);
    setPaymentMethod("card");

    setPackagesLoading(true);
    setPackagesError(null);
    settingsService
      .getPricePackages(venueId ?? undefined)
      .then((data: unknown) => {
        const list = (Array.isArray(data) ? data : []).map((item, index) => normalizePricePackage(item, index));
        setPricePackages(list);
        setSelectedPackageId(list[0]?.id ?? "");
      })
      .catch((err: any) => {
        setPackagesError(readApiUserError(err, "Ошибка загрузки пакетов"));
        setPricePackages([]);
        setSelectedPackageId("");
      })
      .finally(() => setPackagesLoading(false));

    setPromosLoading(true);
    setPromosError(null);
    promosService
      .list({ status: "ACTIVE", venueId: venueId ?? undefined })
      .then((data: unknown) => {
        const rawPromos = Array.isArray(data) ? data : [];
        const activeNow = (rawPromos as PromoOption[]).filter((p) => promoIsActiveNow(p));
        setPromos(activeNow);
      })
      .catch((err: any) => {
        setPromosError(readApiUserError(err, "Ошибка загрузки акций"));
        setPromos([]);
      })
      .finally(() => setPromosLoading(false));
  }, [playerId, venueId]);

  const selectedPackage = useMemo(
    () => pricePackages.find((p) => p.id === selectedPackageId) ?? null,
    [pricePackages, selectedPackageId],
  );

  const selectedPromos = useMemo(
    () => promos.filter((p) => selectedPromoIds.includes(p.id)),
    [promos, selectedPromoIds],
  );

  const promosAvailableToAdd = useMemo(
    () => promos.filter((p) => !selectedPromoIds.includes(p.id)),
    [promos, selectedPromoIds],
  );

  const computed = useMemo(() => {
    const perMinutePrice =
      selectedPackage && selectedPackage.minutes > 0 ? selectedPackage.costTenge / selectedPackage.minutes : null;

    let baseMinutes = 0;
    let basePayBeforeDiscount = 0;

    if (baseMode === "packages") {
      baseMinutes = selectedPackage?.minutes ?? 0;
      basePayBeforeDiscount = selectedPackage?.costTenge ?? 0;
    } else {
      baseMinutes = Math.max(0, individualMinutes);
      basePayBeforeDiscount =
        perMinutePrice !== null ? Math.round(perMinutePrice * baseMinutes) : 0;
    }

    let promoBonusMinutes = 0;
    let discountPercent = 0;
    for (const p of selectedPromos) {
      const bm = parsePromoBonusMinutes(p.quantity);
      if (bm != null) promoBonusMinutes += bm;
      const d =
        parsePromoDiscountPercent(p.quantity) ?? parsePromoDiscountPercent(p.reward);
      if (d != null) discountPercent = Math.max(discountPercent, d);
    }

    const levelMinutes = levelBonusEnabled ? 50 : 0;
    const totalMinutes = baseMinutes + promoBonusMinutes + levelMinutes;
    const totalSeconds = totalMinutes * 60;
    const totalPay = Math.round(basePayBeforeDiscount * (1 - discountPercent / 100));

    const baseOk =
      baseMode === "packages"
        ? Boolean(selectedPackage && baseMinutes > 0)
        : baseMinutes > 0 && perMinutePrice !== null;

    const canSubmit = totalSeconds >= 60 && baseOk;

    return {
      baseMinutes,
      promoBonusMinutes,
      levelMinutes,
      discountPercent,
      basePayBeforeDiscount,
      totalMinutes,
      totalSeconds,
      totalPay,
      canSubmit,
    };
  }, [baseMode, individualMinutes, levelBonusEnabled, selectedPackage, selectedPromos]);

  const showPriceStrike =
    computed.discountPercent > 0 && computed.basePayBeforeDiscount !== computed.totalPay;

  return (
    <div
      className={`flex min-h-0 w-full max-h-[min(100%,88dvh,calc(100dvh-6rem))] flex-col ${
        className ?? "max-w-md"
      }`}
    >
      <div className="flex shrink-0 items-center gap-3 pb-3">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
          >
            <BackIcon />
          </button>
        ) : null}
        <h2 className="text-lg font-semibold text-text-primary">Пополнение баланса</h2>
      </div>
      <div className="crm-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2">
        <div className="space-y-5 pb-2">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Пополнение</p>
              <div className="space-y-2.5">
                <div
                  className={`rounded-xl bg-[#1F2B38] px-4 py-3 ${baseMode === "packages" ? "ring-1 ring-inset ring-cyan/35" : ""}`}
                >
                  <label className="flex cursor-pointer items-start justify-between gap-3">
                    <span className="text-sm text-text-primary">Через пакеты</span>
                    <input
                      type="radio"
                      name="baseTopup"
                      checked={baseMode === "packages"}
                      onChange={() => setBaseMode("packages")}
                      className="mt-0.5 h-4 w-4 accent-cyan"
                    />
                  </label>
                  {baseMode === "packages" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {packagesLoading ? (
                        <span className="text-sm text-text-secondary">Загрузка пакетов...</span>
                      ) : pricePackages.length ? (
                        pricePackages.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPackageId(p.id)}
                            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                              selectedPackageId === p.id
                                ? "border-cyan/40 bg-cyan/15 text-cyan"
                                : "border-surface-border bg-bg-primary text-text-secondary"
                            }`}
                          >
                            {p.name}
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-text-secondary">Нет доступных пакетов</span>
                      )}
                    </div>
                  ) : null}
                </div>

                <div
                  className={`rounded-xl bg-[#1F2B38] px-4 py-3 ${baseMode === "individual" ? "ring-1 ring-inset ring-cyan/35" : ""}`}
                >
                  <label className="flex cursor-pointer items-start justify-between gap-3">
                    <span className="text-sm text-text-primary">Индивидуальные минуты</span>
                    <input
                      type="radio"
                      name="baseTopup"
                      checked={baseMode === "individual"}
                      onChange={() => setBaseMode("individual")}
                      className="mt-0.5 h-4 w-4 accent-cyan"
                    />
                  </label>
                  {baseMode === "individual" ? (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIndividualMinutes((m) => Math.max(0, m - 5))}
                        className="h-9 w-9 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        value={`${individualMinutes} мин`}
                        readOnly
                        className="h-9 w-24 rounded-lg border border-surface-border bg-bg-card px-2 text-center text-sm text-text-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setIndividualMinutes((m) => m + 5)}
                        className="h-9 w-9 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card"
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#1F2B38] px-3 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Акции</p>
              <div className="mb-2 flex flex-wrap content-start gap-1.5">
                {selectedPromos.map((p) => {
                  const effect = promoEffectLabel(p);
                  const suffix = effect.text || p.quantity || "";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => removePromo(p.id)}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan/35 bg-cyan/10 py-0.5 pl-2 pr-1 text-left text-[11px] font-medium text-cyan transition-colors hover:bg-cyan/20"
                      title="Снять"
                    >
                      <span className="min-w-0 truncate">{p.title}</span>
                      {suffix ? (
                        <span
                          className={
                            effect.kind === "discount" ? "shrink-0 tabular-nums text-danger" : "shrink-0 tabular-nums"
                          }
                        >
                          {suffix}
                        </span>
                      ) : null}
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-text-primary">
                        ×
                      </span>
                    </button>
                  );
                })}
              </div>
              <PromoAddDropdown
                key={playerId}
                promosTotal={promos.length}
                options={promosAvailableToAdd}
                loading={promosLoading}
                onPick={(id) =>
                  setSelectedPromoIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                }
              />
              {promosError ? <p className="mt-2 text-xs text-danger">{promosError}</p> : null}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Дополнительно</p>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#1F2B38] px-4 py-3">
                <span className="text-sm text-text-primary">Бонусные минуты от уровня</span>
                <input
                  type="checkbox"
                  checked={levelBonusEnabled}
                  onChange={(e) => setLevelBonusEnabled(e.target.checked)}
                  className="h-4 w-4 accent-cyan"
                />
              </label>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <div className="flex gap-2">
              {(["cash", "card", "kaspi_qr"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`h-11 min-w-0 flex-1 rounded-lg border px-2 text-[11px] font-medium leading-tight whitespace-nowrap transition-colors ${
                    paymentMethod === method
                      ? "border-cyan/40 bg-cyan/15 text-cyan"
                      : "border-surface-border bg-[#1F2B38] text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {method === "cash" ? "Наличные" : method === "card" ? "Платежные карты" : "Kaspi QR"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-surface-border bg-[#141C26] pt-3 pb-4">
        <div className="space-y-2">
          {computed.promoBonusMinutes > 0 ||
          computed.levelMinutes > 0 ||
          computed.discountPercent > 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
              <div className="flex min-h-[22px] flex-wrap items-center gap-1.5">
                {computed.promoBonusMinutes > 0 ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success tabular-nums">
                    +{computed.promoBonusMinutes} мин
                  </span>
                ) : null}
                {computed.levelMinutes > 0 ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success tabular-nums">
                    +{computed.levelMinutes} мин
                  </span>
                ) : null}
              </div>
              <div className="flex min-h-[22px] items-center justify-end">
                {computed.discountPercent > 0 ? (
                  <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger tabular-nums">
                    −{computed.discountPercent}%
                  </span>
                ) : null}
              </div>
              <div className="min-w-[165px] shrink-0" aria-hidden />
            </div>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
              <div className="flex min-w-0 flex-col">
                {showPriceStrike ? (
                  <div className="mb-1 h-5 shrink-0" aria-hidden />
                ) : null}
                <p className="whitespace-nowrap text-2xl font-semibold leading-none text-text-primary tabular-nums">
                  {computed.totalMinutes}
                  <span className="ml-1 text-base">мин</span>
                </p>
                <p className="mt-1 whitespace-nowrap text-[11px] text-text-secondary">Общие минуты</p>
              </div>
              <div className="flex min-w-0 flex-col items-end text-right">
                {showPriceStrike ? (
                  <p className="mb-1 max-w-full truncate text-sm leading-5 text-text-muted line-through tabular-nums">
                    {computed.basePayBeforeDiscount.toLocaleString("ru-RU")} ₸
                  </p>
                ) : null}
                <p className="whitespace-nowrap text-2xl font-semibold leading-none text-text-primary tabular-nums">
                  {computed.totalPay.toLocaleString("ru-RU")}
                  <span className="ml-1 text-base">₸</span>
                </p>
                <p className="mt-1 whitespace-nowrap text-[11px] text-text-secondary">Итого к оплате</p>
              </div>
              <Button
                type="button"
                className="h-11 w-[165px] shrink-0 self-end rounded-xl text-sm"
                onClick={() => {
                  if (submitting) return;
                  setError(null);

                  if (!playerId) {
                    setError("Не выбран игрок");
                    return;
                  }

                  if (!computed.canSubmit) {
                    setError("Невозможно оформить пополнение");
                    return;
                  }

                  const promoPart =
                    selectedPromos.length > 0
                      ? ` Акции: ${selectedPromos.map((p) => `«${p.title}» (${p.id})`).join("; ")}.`
                      : "";
                  const disc =
                    computed.discountPercent > 0
                      ? ` Скидка ${computed.discountPercent}% от ${computed.basePayBeforeDiscount} ₸.`
                      : "";

                  setSubmitting(true);
                  balanceService
                    .topup({
                      userId: playerId,
                      seconds: computed.totalSeconds,
                      bonusSeconds: (computed.promoBonusMinutes + computed.levelMinutes) * 60,
                      amountTenge: computed.totalPay,
                      ...(venueId ? { venueId } : {}),
                      description: `Пополнение (${baseMode}, ${paymentMethod})${promoPart}${disc} ${playerName ?? "игрок"}`,
                    })
                    .then(() => {
                      onSuccess?.();
                      onClose?.();
                    })
                    .catch((err: any) => {
                      setError(readApiUserError(err, "Ошибка пополнения"));
                    })
                    .finally(() => {
                      setSubmitting(false);
                    });
                }}
              >
                {submitting ? "Подтверждение..." : "Подтвердить оплату"}
              </Button>
          </div>
        </div>
        {error ? <p className="text-danger mt-2 text-sm">{error}</p> : null}
        {packagesError && baseMode === "packages" ? (
          <p className="text-danger mt-1 text-sm">{packagesError}</p>
        ) : null}
      </div>
    </div>
  );
}

export function BalanceTopUpModal({
  isOpen,
  onClose,
  playerId,
  playerName,
  venueId,
  onSuccess,
}: BalanceTopUpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[min(92dvh,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[#141C26] px-5 pt-5 pb-7 shadow-xl">
        <BalanceTopUpPanel
          playerId={playerId}
          playerName={playerName}
          venueId={venueId}
          onSuccess={onSuccess}
          onClose={onClose}
          className="mx-auto min-h-0 w-full max-w-lg flex-1"
        />
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
