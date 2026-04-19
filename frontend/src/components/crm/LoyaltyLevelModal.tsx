"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Button } from "@/components/ui";
import { settingsService } from "@/services/settings.service";
import { readApiUserError } from "@/lib/api-error-message";

export type LoyaltyLevelFields = {
  id: string;
  name: string;
  minPoints: number;
  bonusMinutes: number;
  colorGradient: string;
  colorBg: string;
};

export type LoyaltyLevelModalState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; level: LoyaltyLevelFields };

interface LoyaltyLevelModalProps {
  state: LoyaltyLevelModalState;
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

function parseGradientHexes(gradient: string): { bg: string; fg: string } {
  const m = String(gradient || "").match(
    /linear-gradient\s*\(\s*135deg\s*,\s*#([0-9A-Fa-f]{3,8})\s*,\s*#([0-9A-Fa-f]{3,8})\s*\)/i,
  );
  if (m) return { bg: m[1] ?? "", fg: m[2] ?? "" };
  return { bg: "", fg: "" };
}

/** Для `<input type="color">` и превью: всегда 6 hex-символов */
function expandToSixHex(hex: string): string {
  const h = hex
    .replace(/^#/, "")
    .replace(/[^0-9A-Fa-f]/gi, "")
    .toUpperCase();
  if (h.length === 0) return "000000";
  if (h.length <= 3) {
    const p = h.padEnd(3, "0").slice(0, 3);
    return p
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h.padEnd(6, "0").slice(0, 6);
}

function HexColorRow({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (hexDigits: string) => void;
  id: string;
}) {
  const full = expandToSixHex(value);
  return (
    <div>
      <label htmlFor={`${id}-hex`} className="mb-2 block text-sm text-text-secondary">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={`#${full}`}
          onChange={(e) => onChange(e.target.value.replace(/^#/, "").toUpperCase())}
          className="m-0 box-border h-12 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-surface-border bg-transparent p-0 align-middle shadow-sm [color-scheme:dark] [&::-webkit-color-swatch-wrapper]:m-0 [&::-webkit-color-swatch-wrapper]:h-full [&::-webkit-color-swatch-wrapper]:w-full [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:h-full [&::-webkit-color-swatch]:w-full [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:border-0"
          title="Выбрать цвет"
          aria-label={label}
        />
        <input
          id={`${id}-hex`}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9A-Fa-f]/gi, "").slice(0, 6);
            onChange(v.toUpperCase());
          }}
          onBlur={() => onChange(expandToSixHex(value))}
          className="box-border h-12 min-w-0 flex-1 rounded-lg border border-surface-border bg-[#1F2B38] px-3 font-mono text-sm leading-none text-text-primary outline-none transition-colors focus:border-cyan/40"
          placeholder="RRGGBB"
          aria-label={`${label}, HEX`}
        />
      </div>
    </div>
  );
}

export function LoyaltyLevelModal({ state, onClose, onSaved }: LoyaltyLevelModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("0");
  const [minutes, setMinutes] = useState(15);
  /** Текст в поле минут (позволяет пустое значение во время ввода) */
  const [minutesInput, setMinutesInput] = useState("15");
  const [bgColor, setBgColor] = useState("FFD86A");
  const [textColor, setTextColor] = useState("2A1C00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = state.kind !== "closed";
  const mode = state.kind === "edit" ? "edit" : state.kind === "add" ? "add" : null;
  const editLevel = state.kind === "edit" ? state.level : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state.kind === "closed") return;
    setError(null);
    setSubmitting(false);

    if (state.kind === "add") {
      setName("");
      setPoints("0");
      setMinutes(15);
      setMinutesInput("15");
      setBgColor("FFD86A");
      setTextColor("2A1C00");
      return;
    }

    if (state.kind === "edit") {
      const level = state.level;
      const bonus = level.bonusMinutes ?? 15;
      setName(level.name);
      setPoints(String(level.minPoints));
      setMinutes(bonus);
      setMinutesInput(String(bonus));
      const bgFromField = String(level.colorBg || "")
        .trim()
        .replace(/^#/, "");
      const fromGradient = parseGradientHexes(level.colorGradient || "");
      setBgColor(bgFromField || fromGradient.bg);
      setTextColor(fromGradient.fg || "");
    }
  }, [state]);

  function clampMinutes(n: number) {
    return Math.min(999, Math.max(1, Math.floor(n)));
  }

  function commitMinutesField(): number {
    const raw = minutesInput.replace(/\D/g, "");
    if (raw === "") {
      setMinutes(1);
      setMinutesInput("1");
      return 1;
    }
    const c = clampMinutes(parseInt(raw, 10));
    setMinutes(c);
    setMinutesInput(String(c));
    return c;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !mode) return;
    setError(null);

    const trimmedName = String(name || "").trim();
    const minPoints = parseInt(String(points || "").replace(/\D/g, ""), 10);
    const bonusMinutes = commitMinutesField();

    if (!trimmedName) {
      setError("Введите название уровня");
      return;
    }
    if (!Number.isFinite(minPoints) || minPoints < 0) {
      setError("Введите количество нужных очков (число)");
      return;
    }
    if (!Number.isFinite(bonusMinutes) || bonusMinutes < 1) {
      setError("Введите минуты бонуса (минимум 1)");
      return;
    }

    const bg = expandToSixHex(bgColor);
    const fg = expandToSixHex(textColor);
    const colorBg = `#${bg}`;
    const colorGradient = `linear-gradient(135deg, #${bg}, #${fg})`;

    setSubmitting(true);
    const done = () => {
      onSaved?.();
      onClose();
    };

    if (mode === "add") {
      settingsService
        .createLoyaltyLevel({
          name: trimmedName,
          minPoints,
          bonusMinutes,
          colorGradient,
          colorBg,
        })
        .then(() => done())
        .catch((err: unknown) => {
          setError(readApiUserError(err, "Не удалось создать уровень"));
        })
        .finally(() => setSubmitting(false));
      return;
    }

    if (mode === "edit" && editLevel) {
      settingsService
        .updateLoyaltyLevel(editLevel.id, {
          name: trimmedName,
          minPoints,
          bonusMinutes,
          colorGradient,
          colorBg,
        })
        .then(() => done())
        .catch((err: unknown) => {
          setError(readApiUserError(err, "Не удалось сохранить уровень"));
        })
        .finally(() => setSubmitting(false));
    }
  }

  if (!mounted || !isOpen || !mode) return null;

  const titleId = mode === "add" ? "loyalty-add-title" : "loyalty-edit-title";
  const heading = mode === "add" ? "Добавление уровня" : "Редактирование уровня";
  const submitLabel = submitting ? "Сохранение..." : mode === "add" ? "Добавить" : "Сохранить";

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
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
        >
          <div className="mx-auto my-auto flex w-full max-w-md flex-col gap-6 px-6 pb-10 pt-4">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                aria-label="Назад"
              >
                <BackIcon />
              </button>
              <h2 id={titleId} className="text-lg font-semibold text-white">
                {heading}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Наименование уровня"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: BRONZE"
              />
              <Input
                label="Количество нужных очков"
                value={points}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setPoints(v);
                }}
                inputMode="numeric"
                placeholder="Например: 100"
                autoComplete="off"
              />

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Введите минуты</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-lg border border-surface-border bg-[#1F2B38] px-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label="Минуты бонуса"
                      value={minutesInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
                        setMinutesInput(raw);
                        if (raw !== "") {
                          const n = parseInt(raw, 10);
                          if (Number.isFinite(n)) setMinutes(clampMinutes(n));
                        }
                      }}
                      onBlur={() => {
                        commitMinutesField();
                      }}
                      className="min-w-0 flex-1 border-0 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted focus:ring-0"
                      placeholder="1–999"
                    />
                    <span className="shrink-0 text-sm text-text-secondary">мин</span>
                  </div>
                  <StepperButtons
                    value={minutes}
                    min={1}
                    max={999}
                    onChange={(v) => {
                      setMinutes(v);
                      setMinutesInput(String(v));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <HexColorRow
                  id="loyalty-bg"
                  label="Цвет фона"
                  value={bgColor}
                  onChange={setBgColor}
                />
                <HexColorRow
                  id="loyalty-fg"
                  label="Второй стоп градиента"
                  value={textColor}
                  onChange={setTextColor}
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-text-muted">Предпросмотр градиента</p>
                <div
                  className="flex h-14 w-full items-center justify-center rounded-xl border border-surface-border shadow-inner"
                  style={{
                    background: `linear-gradient(135deg, #${expandToSixHex(bgColor)}, #${expandToSixHex(textColor)})`,
                  }}
                >
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: `#${expandToSixHex(textColor)}` }}
                  >
                    Aa · 12 345
                  </span>
                </div>
              </div>

              {error ? <p className="text-danger text-sm">{error}</p> : null}

              <Button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2"
              >
                <CheckIcon />
                {submitLabel}
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
