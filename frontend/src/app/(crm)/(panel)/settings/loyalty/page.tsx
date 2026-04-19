"use client";

import { useState, useEffect } from "react";
import { settingsService } from "@/services/settings.service";
import { readApiUserError } from "@/lib/api-error-message";
import { useAuth } from "@/lib/auth-context";
import { useConfirmDelete } from "@/components/ui/ConfirmDeleteModal";
import {
  LoyaltyLevelModal,
  type LoyaltyLevelModalState,
} from "@/components/crm/LoyaltyLevelModal";

type LoyaltyLevel = {
  id: string;
  name: string;
  minPoints: number;
  bonusMinutes: number;
  colorGradient: string;
  colorBg: string;
};

/** Нормализует hex для отображения (3 → 6, лишние символы обрезает) */
function sanitizeHexDigits(raw: string): string {
  let h = raw.replace(/^#/, "").replace(/[^0-9A-Fa-f]/gi, "");
  if (h.length === 0) return "";
  if (h.length === 3) {
    return h
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase();
  }
  if (h.length > 6) h = h.slice(0, 6);
  return h.padEnd(6, "0").slice(0, 6).toUpperCase();
}

function parseGradientStops(gradient: string): { a: string; b: string } {
  const m = String(gradient || "").match(
    /linear-gradient\s*\(\s*135deg\s*,\s*#([0-9A-Fa-f]+)\s*,\s*#([0-9A-Fa-f]+)\s*\)/i,
  );
  if (!m) return { a: "", b: "" };
  return {
    a: sanitizeHexDigits(m[1] ?? ""),
    b: sanitizeHexDigits(m[2] ?? ""),
  };
}

function loyaltyHexPair(level: LoyaltyLevel): { from: string; to: string } {
  const stops = parseGradientStops(level.colorGradient ?? "");
  const fromBg = sanitizeHexDigits(String(level.colorBg ?? "").replace(/^#/, ""));
  const from = fromBg || stops.a;
  const to = stops.b || stops.a || from;
  return {
    from,
    to: to || from,
  };
}

function LoyaltyColorsCell({ level }: { level: LoyaltyLevel }) {
  const { from, to } = loyaltyHexPair(level);
  if (!from && !to) {
    return <span className="text-text-muted">—</span>;
  }
  const a = from || to;
  const b = to || from;
  const same = a === b;
  return (
    <span className="inline-flex max-w-[min(100%,22rem)] flex-wrap items-center gap-x-1.5 gap-y-1">
      <span
        className="h-4 w-4 shrink-0 rounded-full border border-white/15 bg-bg-primary shadow-inner ring-1 ring-black/25"
        style={{ backgroundColor: `#${a}` }}
        title={`#${a}`}
        aria-hidden
      />
      <span className="font-mono text-xs text-text-primary tabular-nums">{a}</span>
      {!same ? (
        <>
          <span className="text-text-muted">–</span>
          <span className="font-mono text-xs text-text-primary tabular-nums">{b}</span>
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-white/15 bg-bg-primary shadow-inner ring-1 ring-black/25"
            style={{ backgroundColor: `#${b}` }}
            title={`#${b}`}
            aria-hidden
          />
        </>
      ) : null}
    </span>
  );
}

function formatNumber(value: number) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function SettingsLoyaltyPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";

  const [levels, setLevels] = useState<LoyaltyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [operationError, setOperationError] = useState<string | null>(null);
  const { confirmDelete, dialog: deleteDialog } = useConfirmDelete();
  const [loyaltyModal, setLoyaltyModal] = useState<LoyaltyLevelModalState>({ kind: "closed" });

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    settingsService
      .getLoyaltyLevels()
      .then((data: LoyaltyLevel[]) => {
        if (!cancelled) setLevels(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(readApiUserError(err, "Не удалось загрузить уровни лояльности"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  function refreshLevels() {
    setRefreshTick((t) => t + 1);
  }

  async function handleDelete(level: LoyaltyLevel) {
    if (!isAdmin || deletingId) return;
    const ok = await confirmDelete({
      title: "Удалить уровень лояльности?",
      message: `Уровень «${level.name}» будет удалён безвозвратно.`,
    });
    if (!ok) return;
    setOperationError(null);
    setDeletingId(level.id);
    try {
      await settingsService.deleteLoyaltyLevel(level.id);
      refreshLevels();
    } catch (err) {
      setOperationError(readApiUserError(err, "Не удалось удалить уровень"));
    } finally {
      setDeletingId(null);
    }
  }

  const mappedLevels = levels.map((l) => ({
    ...l,
    points: `от ${formatNumber(l.minPoints)}`,
    bonusMinutesDisplay: `${l.bonusMinutes} мин`,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-text-muted">Загрузка…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {operationError ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{operationError}</p>
      ) : null}
      <div className="bg-bg-secondary rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-text-secondary">
              <th className="py-3 px-4 font-medium">Наименование уровня</th>
              <th className="py-3 px-4 font-medium">Цвета</th>
              <th className="py-3 px-4 font-medium">Количество нужных очков</th>
              <th className="py-3 px-4 font-medium">Количество бонусных минут</th>
              <th className="py-3 px-4 w-40 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {mappedLevels.map((l) => (
              <tr key={l.id} className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/30">
                <td className="py-3 px-4 text-text-primary font-medium">{l.name}</td>
                <td className="py-3 px-4">
                  <LoyaltyColorsCell level={l} />
                </td>
                <td className="py-3 px-4 text-text-primary">{l.points}</td>
                <td className="py-3 px-4 text-text-primary">{l.bonusMinutesDisplay}</td>
                <td className="py-3 px-4 text-right">
                  {isAdmin ? (
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={deletingId !== null}
                        onClick={() =>
                          setLoyaltyModal({
                            kind: "edit",
                            level: {
                              id: l.id,
                              name: l.name,
                              minPoints: l.minPoints,
                              bonusMinutes: l.bonusMinutes,
                              colorGradient: l.colorGradient,
                              colorBg: l.colorBg,
                            },
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#24364A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A3E55] disabled:opacity-50"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Изменить
                      </button>
                      <button
                        type="button"
                        disabled={deletingId !== null}
                        onClick={() => void handleDelete(l)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#24364A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A3E55] disabled:opacity-50"
                      >
                        <TrashIcon className="w-4 h-4" />
                        {deletingId === l.id ? "Удаление…" : "Удалить"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">Только администратор</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin ? (
        <button
          type="button"
          onClick={() => setLoyaltyModal({ kind: "add" })}
          className="fixed bottom-8 right-8 flex items-center gap-2 rounded-xl bg-cyan px-5 py-3 text-sm font-semibold text-bg-primary shadow-lg transition-opacity hover:brightness-110"
        >
          <PlusIcon className="h-5 w-5" />
          Добавить
        </button>
      ) : null}
      <LoyaltyLevelModal
        state={loyaltyModal}
        onClose={() => setLoyaltyModal({ kind: "closed" })}
        onSaved={() => {
          setOperationError(null);
          refreshLevels();
        }}
      />
      {deleteDialog}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
