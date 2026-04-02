"use client";

import { useState, useEffect } from "react";
import { AddPricePackageModal } from "@/components/crm/AddPricePackageModal";
import { settingsService } from "@/services/settings.service";
import { readApiUserError } from "@/lib/api-error-message";

type PricePackage = { id: string; name: string; minutes: number; costTenge: number };

function formatCost(value: number) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function SettingsPricesPage() {
  const [packages, setPackages] = useState<PricePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    settingsService
      .getPricePackages()
      .then((data: PricePackage[]) => {
        if (!cancelled) setPackages(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(readApiUserError(err, "Не удалось загрузить пакеты"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  function refreshPackages() {
    setRefreshTick((v) => v + 1);
  }

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
              <th className="py-3 px-4 font-medium">Наименование пакета</th>
              <th className="py-3 px-4 font-medium">Количество минут</th>
              <th className="py-3 px-4 font-medium">Стоимость</th>
              <th className="py-3 px-4 w-40 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/30">
                <td className="py-3 px-4 text-text-primary">{p.name}</td>
                <td className="py-3 px-4 text-text-primary">{p.minutes} минут</td>
                <td className="py-3 px-4 text-text-primary">{formatCost(p.costTenge)}</td>
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
      <button
        type="button"
        onClick={() => setAddModalOpen(true)}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
      >
        <PlusIcon className="w-5 h-5" />
        Добавить
      </button>
      <AddPricePackageModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={refreshPackages}
      />
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
