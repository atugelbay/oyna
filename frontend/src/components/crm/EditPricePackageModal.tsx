"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Button } from "@/components/ui";
import { settingsService } from "@/services/settings.service";
import { readApiUserError } from "@/lib/api-error-message";

export type EditPricePackage = {
  id: string;
  name: string;
  minutes: number;
  costTenge: number;
};

interface EditPricePackageModalProps {
  isOpen: boolean;
  package: EditPricePackage | null;
  onClose: () => void;
  onSaved?: () => void;
}

function StepperButtons({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border text-text-primary hover:bg-bg-card"
      >
        -
      </button>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border text-text-primary hover:bg-bg-card"
      >
        +
      </button>
    </div>
  );
}

export function EditPricePackageModal({ isOpen, package: pkg, onClose, onSaved }: EditPricePackageModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !pkg) return;
    setName(pkg.name);
    setCost(String(pkg.costTenge ?? ""));
    setMinutes(pkg.minutes);
    setError(null);
    setSubmitting(false);
  }, [isOpen, pkg]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !pkg) return;
    setError(null);

    const trimmedName = String(name || "").trim();
    const costTenge = parseInt(String(cost || "").replace(/\D/g, ""), 10);

    if (!trimmedName) {
      setError("Введите название пакета");
      return;
    }
    if (!Number.isFinite(costTenge) || costTenge < 0) {
      setError("Введите стоимость пакета (тенге)");
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      setError("Введите количество минут (минимум 1)");
      return;
    }

    setSubmitting(true);
    settingsService
      .updatePricePackage(pkg.id, {
        name: trimmedName,
        minutes,
        costTenge,
      })
      .then(() => {
        onSaved?.();
        onClose();
      })
      .catch((err: unknown) => {
        setError(readApiUserError(err, "Не удалось сохранить пакет"));
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  if (!mounted || !isOpen || !pkg) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] h-[100dvh] w-full max-w-[100vw]">
      <button
        type="button"
        className="absolute inset-0 h-full min-h-[100dvh] w-full border-0 bg-black/25 p-0 backdrop-blur-xl"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        className="absolute bottom-0 left-1/2 top-0 z-10 flex w-full max-w-xl -translate-x-1/2 flex-col bg-[#141C26] shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-price-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
        >
          <div className="my-auto mx-auto flex w-full max-w-md flex-col gap-6 px-6 pb-10 pt-4">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                aria-label="Назад"
              >
                <BackIcon />
              </button>
              <h2 id="edit-price-title" className="text-lg font-semibold text-white">
                Редактирование пакета
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input label="Наименование пакета" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Введите стоимость пакета" value={cost} onChange={(e) => setCost(e.target.value)} />

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Введите минуты</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 flex-1 items-center rounded-lg border border-surface-border bg-[#1F2B38] px-4 text-text-primary">
                    {minutes} мин
                  </div>
                  <StepperButtons value={minutes} min={1} max={999} onChange={setMinutes} />
                </div>
              </div>

              {error ? <p className="text-danger text-sm">{error}</p> : null}

              <Button type="submit" disabled={submitting} className="mt-2 inline-flex w-full items-center justify-center gap-2">
                <CheckIcon />
                {submitting ? "Сохранение..." : "Сохранить"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
