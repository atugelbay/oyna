"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { tournamentsService } from "@/services/tournaments.service";
import { venuesService } from "@/services/venues.service";
import { readApiUserError } from "@/lib/api-error-message";

const STEPS = 3;

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-10 h-10 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card">−</button>
      <span className="w-12 text-center text-text-primary font-medium">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-10 h-10 rounded-lg border border-surface-border text-text-primary hover:bg-bg-card">+</button>
    </div>
  );
}

export default function NewTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("КазНУ");
  const [type, setType] = useState("Студентческая");
  const [dateStart, setDateStart] = useState("2026-02-02");
  const [dateEnd, setDateEnd] = useState("2026-02-06");
  const [maxTeams, setMaxTeams] = useState(1);
  const [status, setStatus] = useState<"pending" | "active" | "completed">("completed");
  const [timePerRoom, setTimePerRoom] = useState(15);
  const [minTeamSize, setMinTeamSize] = useState(1);
  const [maxTeamSize, setMaxTeamSize] = useState(1);
  const [maxLives, setMaxLives] = useState(1);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [description, setDescription] = useState("КазНУ");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    venuesService.list().then((venues: { id: string }[]) => {
      if (venues?.length) setVenueId(venues[0].id);
    });
  }, []);

  const progress = (step / STEPS) * 100;

  const handleCreate = async () => {
    if (!venueId) {
      setSubmitError("Нет доступных площадок. Добавьте площадку для создания турнира.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await tournamentsService.create({
        name,
        description: description || undefined,
        venueId,
        dateStart: new Date(dateStart).toISOString(),
        dateEnd: new Date(dateEnd).toISOString(),
        maxTeams,
      });
      router.push("/tournaments");
    } catch (err: unknown) {
      setSubmitError(readApiUserError(err, "Не удалось создать турнир"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg">
          <BackIcon />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Добавление турнира</h1>
      </div>

      <div className="h-1.5 bg-bg-card rounded-full overflow-hidden">
        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="border border-dashed border-surface-border rounded-xl p-6 text-center">
            <PictureIcon className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-secondary mb-2">Прикрепите картинку</p>
            <button type="button" className="text-cyan text-sm font-medium">Выбрать файл</button>
          </div>
          <Input label="Наименование" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="relative">
            <Input label="Тип турнира" value={type} onChange={(e) => setType(e.target.value)} />
            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">×</button>
          </div>
          <Input label="Дата начала" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          <Input label="Дата окончания" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          <div>
            <label className="block text-sm text-text-secondary mb-2">Макс. количество команд <InfoIcon className="inline w-4 h-4 ml-1" /></label>
            <Stepper value={maxTeams} min={1} max={99} onChange={setMaxTeams} />
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
                    status === s ? "bg-cyan/20 text-cyan border-cyan/40" : "border-surface-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {s === "pending" ? "В ожидании" : s === "active" ? "Активный" : "Завершенный"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Время на комнату (мин)</label>
            <Stepper value={timePerRoom} min={1} max={120} onChange={setTimePerRoom} />
            <span className="ml-2 text-text-secondary text-sm">{timePerRoom} мин</span>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">Мин. размер команды <InfoIcon className="inline w-4 h-4" /></label>
            <Stepper value={minTeamSize} min={1} max={20} onChange={setMinTeamSize} />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">Макс. размер команды <InfoIcon className="inline w-4 h-4" /></label>
            <Stepper value={maxTeamSize} min={1} max={20} onChange={setMaxTeamSize} />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">Макс. жизней <InfoIcon className="inline w-4 h-4" /></label>
            <Stepper value={maxLives} min={1} max={10} onChange={setMaxLives} />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">Макс. попыток <InfoIcon className="inline w-4 h-4" /></label>
            <Stepper value={maxAttempts} min={1} max={10} onChange={setMaxAttempts} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Правила / Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 bg-bg-secondary border border-surface-border rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-cyan resize-none"
            />
          </div>
        </div>
      )}

      {submitError && (
        <p className="text-sm text-danger">{submitError}</p>
      )}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="flex items-center gap-2"
        >
          <BackIcon />
          Назад
        </Button>
        {step < STEPS ? (
          <Button type="button" onClick={() => { setSubmitError(null); setStep((s) => s + 1); }} className="flex items-center gap-2">
            Далее
            <NextIcon />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            className="flex items-center gap-2"
          >
            {submitting ? "Создание…" : "Создать"}
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
