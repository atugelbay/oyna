"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { settingsService } from "@/services/settings.service";
import { venuesService } from "@/services/venues.service";
import { readApiUserError } from "@/lib/api-error-message";

function StepperButtons({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-10 rounded-full border border-surface-border text-text-primary hover:bg-bg-card flex items-center justify-center"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-10 h-10 rounded-full border border-surface-border text-text-primary hover:bg-bg-card flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

export default function NewPricePackagePage() {
  const router = useRouter();
  const [name, setName] = useState("Стандарт");
  const [cost, setCost] = useState("15 мин");
  const [minutes, setMinutes] = useState(15);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingVenue(true);
    venuesService
      .list()
      .then((venues: { id: string }[]) => {
        if (cancelled) return;
        setVenueId(venues?.[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setVenueId(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingVenue(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (submitting) return;
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
    if (!venueId) {
      setError("Нет доступных площадок. Добавьте площадку для создания пакета.");
      return;
    }

    setSubmitting(true);
    try {
      await settingsService.createPricePackage({
        venueId,
        name: trimmedName,
        minutes,
        costTenge,
      });
      router.push("/settings/prices");
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось создать пакет"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/prices" className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card">
          <BackIcon className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Добавление пакета</h1>
      </div>
      <div className="space-y-4">
        <Input label="Наименование пакета" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Введите стоимость пакета" value={cost} onChange={(e) => setCost(e.target.value)} />
        <div>
          <label className="block text-sm text-text-secondary mb-2">Введите минуты</label>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-14 px-4 bg-bg-secondary border border-surface-border rounded-lg flex items-center text-text-primary">
              {minutes} мин
            </div>
            <StepperButtons value={minutes} min={1} max={999} onChange={setMinutes} />
          </div>
        </div>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {loadingVenue && !venueId ? <p className="text-text-secondary text-sm">Загрузка площадки...</p> : null}

      <Button type="button" onClick={handleCreate} disabled={submitting} className="w-full flex items-center justify-center gap-2">
        <CheckIcon className="w-5 h-5" />
        {submitting ? "Создание..." : "Добавить"}
      </Button>
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
