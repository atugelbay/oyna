"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { settingsService } from "@/services/settings.service";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";

type EmployeeRole = "OPERATOR" | "MANAGER";

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "OPERATOR", label: "Оператор" },
  { value: "MANAGER", label: "Менеджер" },
];

function getRoleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

type ApiEmployee = {
  id: string;
  name: string;
  phone: string;
  role: string;
};

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const id = typeof params.id === "string" ? params.id : "";
  const { selectedVenueId } = useCrmVenue();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<EmployeeRole>("OPERATOR");
  const [roleOpen, setRoleOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      let list = (await settingsService.getEmployees(
        selectedVenueId ?? undefined,
      )) as ApiEmployee[];
      let row = Array.isArray(list) ? list.find((u) => u.id === id) : null;
      if (!row && selectedVenueId) {
        list = (await settingsService.getEmployees(undefined)) as ApiEmployee[];
        row = Array.isArray(list) ? list.find((u) => u.id === id) : null;
      }
      if (!row) {
        setError("Сотрудник не найден");
        setName("");
        setPhone("");
        return;
      }
      setName(row.name ?? "");
      setPhone(row.phone ?? "");
      const r = row.role?.toUpperCase() === "MANAGER" ? "MANAGER" : "OPERATOR";
      setRole(r);
    } catch (err: unknown) {
      setError(readApiUserError(err, "Ошибка загрузки"));
    } finally {
      setLoading(false);
    }
  }, [id, selectedVenueId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (submitting || !id) return;
    setError(null);
    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      setError("Введите имя сотрудника");
      return;
    }
    setSubmitting(true);
    try {
      await settingsService.updateEmployee(id, { name: trimmedName, role });
      router.push("/settings/employees");
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось сохранить"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8">
        <p className="text-text-secondary text-sm">Редактирование доступно только администратору.</p>
        <Link href="/settings/employees" className="text-cyan text-sm hover:underline">
          К списку сотрудников
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-text-muted">Загрузка…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/employees"
          className="rounded-lg p-2 text-text-secondary hover:bg-bg-card hover:text-text-primary"
        >
          <BackIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Редактирование сотрудника</h1>
      </div>

      <div className="space-y-4">
        <Input label="Имя сотрудника" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Номер телефона</label>
          <p className="rounded-lg border border-surface-border bg-bg-secondary px-4 py-3 text-sm text-text-primary">
            {phone || "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">Номер нельзя изменить</p>
        </div>
        <div className="relative">
          <label className="mb-2 block text-sm text-text-secondary">Роль сотрудника</label>
          <button
            type="button"
            onClick={() => setRoleOpen(!roleOpen)}
            className="flex h-14 w-full items-center justify-between rounded-lg border border-surface-border bg-bg-secondary px-4 text-left text-text-primary"
          >
            <span>{getRoleLabel(role)}</span>
            <ChevronDownIcon className="h-5 w-5 text-text-muted" />
          </button>
          {roleOpen ? (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-surface-border bg-bg-secondary shadow-lg">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setRole(r.value);
                    setRoleOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-bg-card"
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button
        type="button"
        onClick={() => void handleSave()}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2"
      >
        <CheckIcon className="h-5 w-5" />
        {submitting ? "Сохранение..." : "Сохранить"}
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
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
