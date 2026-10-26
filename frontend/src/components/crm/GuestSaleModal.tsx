"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";
import { settingsService } from "@/services/settings.service";
import { balanceService } from "@/services/balance.service";
import { readApiUserError } from "@/lib/api-error-message";

type BaseMode = "packages" | "individual";
type PaymentMethod = "cash" | "card" | "kaspi_qr";

type PricePackage = {
  id: string;
  name: string;
  minutes: number;
  costTenge: number;
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
  const nameCandidate =
    typeof rawName === "string" ? rawName : typeof obj.code === "string" ? obj.code : undefined;
  const minutes = toNumber(obj.minutes ?? obj.durationMinutes ?? obj.duration);
  const costTenge = toNumber(obj.costTenge ?? obj.price ?? obj.amountTenge);

  return {
    id: String(obj.id ?? obj.code ?? `pkg-${index}`),
    name: nameCandidate && nameCandidate.trim() ? nameCandidate : `Пакет ${Math.max(0, minutes)} мин`,
    minutes,
    costTenge,
  };
}

export type GuestSaleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  venueId?: string | null;
  onSuccess?: () => void;
};

export function GuestSaleModal({ isOpen, onClose, venueId, onSuccess }: GuestSaleModalProps) {
  const [baseMode, setBaseMode] = useState<BaseMode>("packages");
  const [pricePackages, setPricePackages] = useState<PricePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [individualMinutes, setIndividualMinutes] = useState(60);
  const [amountTenge, setAmountTenge] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [comment, setComment] = useState("Гость");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
    setBaseMode("packages");
    setIndividualMinutes(60);
    setPaymentMethod("cash");
    setComment("Гость");
    setAmountTenge(0);

    setPackagesLoading(true);
    setPackagesError(null);
    settingsService
      .getPricePackages(venueId ?? undefined)
      .then((data: unknown) => {
        const list = (Array.isArray(data) ? data : []).map((item, index) =>
          normalizePricePackage(item, index),
        );
        setPricePackages(list);
        setSelectedPackageId(list[0]?.id ?? "");
        if (list[0]) setAmountTenge(list[0].costTenge);
      })
      .catch((err: unknown) => {
        setPackagesError(readApiUserError(err, "Ошибка загрузки пакетов"));
        setPricePackages([]);
        setSelectedPackageId("");
      })
      .finally(() => setPackagesLoading(false));
  }, [isOpen, venueId]);

  const selectedPackage = useMemo(
    () => pricePackages.find((p) => p.id === selectedPackageId) ?? null,
    [pricePackages, selectedPackageId],
  );

  const perMinutePrice =
    selectedPackage && selectedPackage.minutes > 0
      ? selectedPackage.costTenge / selectedPackage.minutes
      : null;

  const minutes =
    baseMode === "packages"
      ? selectedPackage?.minutes ?? 0
      : Math.max(0, individualMinutes);

  const packageName =
    baseMode === "packages" && selectedPackage ? selectedPackage.name : undefined;

  useEffect(() => {
    if (!isOpen) return;
    if (baseMode === "packages" && selectedPackage) {
      setAmountTenge(selectedPackage.costTenge);
    } else if (baseMode === "individual" && perMinutePrice != null) {
      setAmountTenge(Math.round(perMinutePrice * Math.max(0, individualMinutes)));
    }
  }, [isOpen, baseMode, selectedPackage, perMinutePrice, individualMinutes]);

  const canSubmit =
    Boolean(venueId) &&
    minutes >= 1 &&
    amountTenge >= 0 &&
    (baseMode === "packages" ? Boolean(selectedPackage) : true) &&
    comment.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[min(92dvh,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#141C26] px-5 pt-5 pb-7 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-white/5 hover:text-white"
            aria-label="Назад"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-white">Гостевая оплата</h2>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <p className="text-xs leading-relaxed text-text-secondary">
            Учёт выручки без аккаунта игрока. После оплаты добавьте гостя на экране комнаты кнопкой + ГОСТЬ.
          </p>

          {!venueId ? (
            <p className="text-sm text-danger">Выберите площадку в шапке CRM.</p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Основание</p>
            <div className="flex gap-2">
              {(
                [
                  { id: "packages" as const, label: "Пакет" },
                  { id: "individual" as const, label: "Минуты" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBaseMode(opt.id)}
                  className={`h-10 flex-1 rounded-lg border text-sm font-medium transition-colors ${
                    baseMode === opt.id
                      ? "border-cyan/40 bg-cyan/15 text-cyan"
                      : "border-surface-border bg-[#1F2B38] text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {baseMode === "packages" ? (
              <div className="space-y-2">
                {packagesLoading ? (
                  <p className="text-xs text-text-secondary">Загрузка пакетов…</p>
                ) : null}
                {packagesError ? <p className="text-xs text-danger">{packagesError}</p> : null}
                {!packagesLoading && pricePackages.length === 0 ? (
                  <p className="text-xs text-text-secondary">Нет пакетов цен для площадки.</p>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  {pricePackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        selectedPackageId === pkg.id
                          ? "border-cyan/40 bg-cyan/10"
                          : "border-surface-border bg-[#1F2B38] hover:border-white/20"
                      }`}
                    >
                      <span className="text-sm text-white">{pkg.name}</span>
                      <span className="text-xs tabular-nums text-text-secondary">
                        {pkg.minutes} мин · {pkg.costTenge.toLocaleString("ru-RU")} ₸
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIndividualMinutes((m) => Math.max(1, m - 5))}
                    className="h-9 w-9 shrink-0 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card"
                  >
                    −
                  </button>
                  <div className="relative flex h-9 min-w-[6.5rem] flex-1 items-center rounded-lg border border-surface-border bg-bg-card">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Минуты"
                      value={String(individualMinutes)}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        if (digits === "") {
                          setIndividualMinutes(0);
                          return;
                        }
                        const n = parseInt(digits, 10);
                        if (!Number.isNaN(n)) setIndividualMinutes(Math.min(999_999, Math.max(0, n)));
                      }}
                      className="h-full w-full bg-transparent py-0 pl-2 pr-10 text-center text-sm text-text-primary outline-none rounded-lg"
                    />
                    <span className="pointer-events-none absolute right-2 text-xs text-text-muted">мин</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIndividualMinutes((m) => m + 5)}
                    className="h-9 w-9 shrink-0 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card"
                  >
                    +
                  </button>
                </div>
                {perMinutePrice == null ? (
                  <p className="text-[11px] text-text-muted">
                    Сумму введите вручную (нет пакета для тарифа ₸/мин).
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Оплата</p>
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
                  {method === "cash" ? "Наличные" : method === "card" ? "Карты" : "Kaspi QR"}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Сумма, ₸"
            inputMode="numeric"
            value={String(amountTenge)}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setAmountTenge(digits === "" ? 0 : Math.min(99_999_999, parseInt(digits, 10) || 0));
            }}
          />

          <Input
            label="Комментарий"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="mt-4 shrink-0 border-t border-surface-border pt-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-text-secondary">{minutes} мин</span>
            <span className="font-semibold tabular-nums text-white">
              {amountTenge.toLocaleString("ru-RU")} ₸
            </span>
          </div>
          {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
          <Button
            type="button"
            className="w-full"
            disabled={!canSubmit || submitting}
            onClick={() => {
              if (!venueId || !canSubmit) return;
              setSubmitting(true);
              setError(null);
              balanceService
                .guestSale({
                  amountTenge,
                  paymentMethod,
                  minutes,
                  venueId,
                  ...(packageName ? { packageName } : {}),
                  comment: comment.trim() || "Гость",
                })
                .then(() => {
                  onSuccess?.();
                  onClose();
                })
                .catch((err: unknown) => {
                  setError(readApiUserError(err, "Ошибка гостевой оплаты"));
                })
                .finally(() => setSubmitting(false));
            }}
          >
            {submitting ? "Сохранение…" : "Записать оплату"}
          </Button>
        </div>
      </div>
    </div>
  );
}
