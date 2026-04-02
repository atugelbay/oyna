"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { promosService } from "@/services/promos.service";
import { readApiUserError } from "@/lib/api-error-message";
const PROMO_TYPES = [
  "День рождения",
  "Бонусные минуты",
  "Скидка от общей суммы",
  "Скидка/Бонусы от минимальной покупки минут",
] as const;

const STEPS = 3;

function Stepper({ value, min, max, onChange, suffix = "" }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-10 h-10 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card">−</button>
      <span className="min-w-[4rem] text-center text-text-primary font-medium">{value}{suffix}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-10 h-10 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card">+</button>
    </div>
  );
}

export default function NewPromoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [promoType, setPromoType] = useState("");
  const [assignType, setAssignType] = useState<"minutes" | "discount">("minutes");
  const [minutes, setMinutes] = useState(15);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [minPurchaseMinutes, setMinPurchaseMinutes] = useState(15);
  const [name, setName] = useState("КазНУ");
  const [dateEnd, setDateEnd] = useState("2026-02-06");
  const [description, setDescription] = useState("КазНУ");
  const [status, setStatus] = useState<"pending" | "active" | "completed">("completed");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = (step / STEPS) * 100;

  async function handleSubmit() {
    if (!promoType || !name) {
      setSubmitError("Заполните тип акции и наименование");
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const dateStart = new Date().toISOString();
      const reward = assignType === "minutes" || promoType === "Бонусные минуты"
        ? "Бонусные минуты"
        : "Скидка";
      const quantity = assignType === "minutes" || promoType === "Бонусные минуты"
        ? `${minutes} мин`
        : `${discountPercent}%`;

      const payload = {
        title: name,
        headline: name,
        description,
        type: promoType,
        reward,
        quantity,
        dateStart,
        dateEnd: dateEnd ? `${dateEnd}T23:59:59.000Z` : undefined,
      };

      await promosService.create(payload);
      router.push("/promos");
    } catch (err: unknown) {
      setSubmitError(readApiUserError(err, "Не удалось создать акцию"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/promos" className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg">
          <BackIcon />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Добавление акции</h1>
      </div>

      <div className="h-1.5 bg-bg-card rounded-full overflow-hidden">
        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm text-text-secondary mb-2">Тип акции</label>
            <button
              type="button"
              onClick={() => (typeDropdownOpen ? setTypeDropdownOpen(false) : setTypeDropdownOpen(true))}
              onBlur={() => setTimeout(() => setTypeDropdownOpen(false), 150)}
              className="w-full h-12 px-4 bg-bg-secondary border border-surface-border rounded-lg text-left text-text-primary flex items-center justify-between"
            >
              <span>{promoType || "Выберите тип"}</span>
              {promoType ? (
                <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setPromoType(""); }} className="text-text-muted hover:text-text-primary">×</span>
              ) : null}
            </button>
            {typeDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-bg-secondary border border-surface-border rounded-lg shadow-lg overflow-hidden">
                {PROMO_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setPromoType(t); setTypeDropdownOpen(false); }}
                    className="w-full px-4 py-3 text-left text-text-primary hover:bg-bg-card"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Тип акции: {promoType || "—"}</p>
          {promoType === "Скидка/Бонусы от минимальной покупки минут" && (
            <div>
              <label className="block text-sm text-text-secondary mb-2">Мин. покупки минут</label>
              <div className="flex items-center gap-2">
                <InfoIcon className="w-4 h-4 text-text-muted shrink-0" />
                <Stepper value={minPurchaseMinutes} min={1} max={999} onChange={setMinPurchaseMinutes} />
                <span className="text-sm text-text-secondary">мин</span>
              </div>
            </div>
          )}
          {promoType !== "Бонусные минуты" && promoType !== "Скидка от общей суммы" && (
            <div>
              <p className="text-sm text-text-secondary mb-2">Что присвоить?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignType("minutes")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    assignType === "minutes" ? "bg-cyan/20 text-cyan border-cyan/40" : "border-surface-border text-text-secondary"
                  }`}
                >
                  Бонусные минуты
                </button>
                <button
                  type="button"
                  onClick={() => setAssignType("discount")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    assignType === "discount" ? "bg-cyan/20 text-cyan border-cyan/40" : "border-surface-border text-text-secondary"
                  }`}
                >
                  Скидка
                </button>
              </div>
            </div>
          )}
          {(assignType === "minutes" || promoType === "Бонусные минуты") && (
            <div>
              <label className="block text-sm text-text-secondary mb-2">Введите минуты</label>
              <div className="flex items-center gap-2">
                <Stepper value={minutes} min={1} max={999} onChange={setMinutes} suffix=" мин" />
              </div>
            </div>
          )}
          {assignType === "discount" && promoType !== "Бонусные минуты" && (
            <div>
              <label className="block text-sm text-text-secondary mb-2">Процент скидки</label>
              <Stepper value={discountPercent} min={1} max={100} onChange={setDiscountPercent} suffix="%" />
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="border border-dashed border-surface-border rounded-xl p-6 text-center">
            <PictureIcon className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-secondary mb-2">Прикрепите картинку</p>
            <button type="button" className="text-cyan text-sm font-medium">Выбрать файл</button>
          </div>
          <Input label="Наименование" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Дата окончания" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          <div>
            <label className="block text-sm text-text-secondary mb-2">Правила / Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-bg-secondary border border-surface-border rounded-lg text-sm text-text-primary outline-none focus:border-cyan resize-none"
            />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-2">Статус</p>
            <div className="flex gap-2">
              {(["pending", "active", "completed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    status === s ? "bg-cyan/20 text-cyan border-cyan/40" : "border-surface-border text-text-secondary"
                  }`}
                >
                  {s === "pending" ? "В ожидании" : s === "active" ? "Активный" : "Завершенный"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === STEPS && submitError && (
        <p className="text-danger text-sm">{submitError}</p>
      )}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="flex items-center gap-2">
          <BackIcon />
          Назад
        </Button>
        {step < STEPS ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)} className="flex items-center gap-2">
            Далее
            <NextIcon />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2">
            {isSubmitting ? "Создание…" : "Создать"}
            <NextIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
function PictureIcon({ className }: { className?: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
