"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { settingsService } from "@/services/settings.service";
import { readApiUserError } from "@/lib/api-error-message";

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-10 rounded-full border border-surface-border text-text-primary hover:bg-bg-card flex items-center justify-center"
      >
        −
      </button>
      <span className="min-w-[3rem] text-center text-text-primary font-medium">{value} мин</span>
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

export default function NewLoyaltyLevelPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [points, setPoints] = useState("15 мин");
  const [minutes, setMinutes] = useState(15);
  const [bgColor, setBgColor] = useState("FFD86A");
  const [textColor, setTextColor] = useState("2A1C00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (submitting) return;
    setError(null);

    const trimmedName = String(name || "").trim();
    const minPoints = parseInt(String(points || "").replace(/\D/g, ""), 10);

    if (!trimmedName) {
      setError("Введите название уровня");
      return;
    }
    if (!Number.isFinite(minPoints) || minPoints < 0) {
      setError("Введите количество нужных очков (число)");
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      setError("Введите минуты бонуса (минимум 1)");
      return;
    }

    const bg = String(bgColor || "").trim().replace(/^#/, "");
    const fg = String(textColor || "").trim().replace(/^#/, "");
    const colorBg = bg ? `#${bg}` : "";
    const colorGradient = bg && fg ? `linear-gradient(135deg, #${bg}, #${fg})` : "";

    setSubmitting(true);
    try {
      await settingsService.createLoyaltyLevel({
        name: trimmedName,
        minPoints,
        bonusMinutes: minutes,
        colorGradient,
        colorBg,
      });
      router.push("/settings/loyalty");
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось создать уровень"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/loyalty" className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card">
          <BackIcon className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Добавление уровня</h1>
      </div>
      <div className="space-y-4">
        <Input label="Наименование пакета" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: BRONZE" />
        <Input label="Введите количество нужных очков" value={points} onChange={(e) => setPoints(e.target.value)} />
        <div>
          <label className="block text-sm text-text-secondary mb-2">Введите минуты</label>
          <Stepper value={minutes} min={1} max={999} onChange={setMinutes} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Цвет фона</label>
            <input
              type="text"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-bg-secondary border border-surface-border text-text-primary text-sm font-mono"
            />
            <div className="mt-2 w-full h-12 rounded-lg border border-surface-border" style={{ backgroundColor: `#${bgColor.replace(/^#/, "")}` }} />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">Цвет текста</label>
            <input
              type="text"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-bg-secondary border border-surface-border text-text-primary text-sm font-mono"
            />
            <div className="mt-2 w-full h-12 rounded-lg border border-surface-border flex items-center justify-center" style={{ backgroundColor: `#${textColor.replace(/^#/, "")}` }}>
              <span className="text-white text-xs font-medium">Aa</span>
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <Button
        type="button"
        onClick={handleCreate}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2"
      >
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
