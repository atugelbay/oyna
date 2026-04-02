"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { settingsService } from "@/services/settings.service";
import { readApiUserError } from "@/lib/api-error-message";

type LoyaltyLevel = {
  id: string;
  name: string;
  minPoints: number;
  bonusMinutes: number;
  colorGradient: string;
  colorBg: string;
};

function formatNumber(value: number) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function SettingsLoyaltyPage() {
  const [levels, setLevels] = useState<LoyaltyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const mappedLevels = levels.map((l) => ({
    ...l,
    points: `от ${formatNumber(l.minPoints)}`,
    bonusMinutes: String(l.bonusMinutes),
    colors: l.colorGradient,
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
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: l.colorBg }} />
                    <span className="text-text-primary">{l.colors}</span>
                  </span>
                </td>
                <td className="py-3 px-4 text-text-primary">{l.points}</td>
                <td className="py-3 px-4 text-text-primary">{l.bonusMinutes}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#24364A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A3E55]"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#24364A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A3E55]"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link
        href="/settings/loyalty/new"
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
      >
        <PlusIcon className="w-5 h-5" />
        Добавить
      </Link>
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
