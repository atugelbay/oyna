"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readApiUserError } from "@/lib/api-error-message";
import { settingsService } from "@/services/settings.service";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";

type Employee = { id: string; name: string; phone: string; role: string };

export default function SettingsEmployeesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedVenueId } = useCrmVenue();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    settingsService
      .getEmployees(selectedVenueId ?? undefined)
      .then((data: Employee[]) => {
        if (!cancelled) setEmployees(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(readApiUserError(err, "Ошибка загрузки"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVenueId]);

  async function handleDelete(e: Employee) {
    if (!isAdmin || deletingId) return;
    const ok = window.confirm(`Удалить сотрудника «${e.name}»? Доступ к CRM будет отключён.`);
    if (!ok) return;
    setDeletingId(e.id);
    setError(null);
    try {
      await settingsService.deleteEmployee(e.id);
      setEmployees((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось удалить сотрудника"));
    } finally {
      setDeletingId(null);
    }
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
              <th className="py-3 px-4 font-medium">Имя сотрудника</th>
              <th className="py-3 px-4 font-medium">Номер телефона</th>
              <th className="py-3 px-4 font-medium">Роль сотрудника</th>
              <th className="py-3 px-4 w-40 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/30">
                <td className="py-3 px-4 text-text-primary">{e.name}</td>
                <td className="py-3 px-4 text-text-primary">{e.phone}</td>
                <td className="py-3 px-4 text-text-primary">{e.role}</td>
                <td className="py-3 px-4 text-right">
                  {isAdmin ? (
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => router.push(`/settings/employees/${e.id}/edit`)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#24364A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A3E55]"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Изменить
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === e.id}
                        onClick={() => void handleDelete(e)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#24364A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A3E55] disabled:opacity-50"
                      >
                        <TrashIcon className="w-4 h-4" />
                        {deletingId === e.id ? "…" : "Удалить"}
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
        <Link
          href="/settings/employees/new"
          className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
        >
          <PlusIcon className="w-5 h-5" />
          Добавить
        </Link>
      ) : null}
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
