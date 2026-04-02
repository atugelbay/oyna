"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input, Button, PhoneInput } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { settingsService } from "@/services/settings.service";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { venuesService } from "@/services/venues.service";

type EmployeeRole = "OPERATOR" | "MANAGER";

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "OPERATOR", label: "Оператор" },
  { value: "MANAGER", label: "Менеджер" },
];

function getRoleLabel(role: EmployeeRole) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

export default function NewEmployeePage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const { selectedVenueId: contextVenueId } = useCrmVenue();
  const [name, setName] = useState("Алибек");
  const [phone, setPhone] = useState("7016378372");
  const [role, setRole] = useState<EmployeeRole>("OPERATOR");
  const [roleOpen, setRoleOpen] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contextVenueId) {
      setVenueId(contextVenueId);
      setLoadingVenue(false);
      return;
    }
    let cancelled = false;
    setLoadingVenue(true);
    venuesService
      .list()
      .then((venues: { id: string; name: string }[]) => {
        if (!cancelled) setVenueId(venues?.[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setVenueId(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingVenue(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contextVenueId]);

  async function handleCreate() {
    if (submitting) return;
    setError(null);

    const trimmedName = String(name || "").trim();
    const phoneDigits = String(phone || "").replace(/\D/g, "");
    const subscriber = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
    const phoneE164 = subscriber.length === 10 ? `+7${subscriber}` : "";

    if (!trimmedName) {
      setError("Введите имя сотрудника");
      return;
    }
    if (!phoneE164) {
      setError("Проверьте номер телефона");
      return;
    }
    if (!venueId) {
      setError("Нет доступных площадок. Добавьте площадку для создания сотрудника.");
      return;
    }

    setSubmitting(true);
    try {
      await settingsService.createEmployee({
        phone: phoneE164,
        name: trimmedName,
        role,
        venueId,
      });
      router.push("/settings/employees");
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось создать сотрудника"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8">
        <p className="text-sm text-text-secondary">Добавление сотрудников доступно только администратору.</p>
        <Link href="/settings/employees" className="text-sm text-cyan hover:underline">
          К списку сотрудников
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/employees" className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card">
          <BackIcon className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Добавление сотрудника</h1>
      </div>
      <div className="space-y-4">
        <Input label="Имя сотрудника" value={name} onChange={(e) => setName(e.target.value)} />
        <PhoneInput label="Номер телефона" value={phone} onChange={setPhone} />
        <div className="relative">
          <label className="block text-sm text-text-secondary mb-2">Роль сотрудника</label>
          <button
            type="button"
            onClick={() => setRoleOpen(!roleOpen)}
            className="w-full h-14 px-4 bg-bg-secondary border border-surface-border rounded-lg text-left text-text-primary flex items-center justify-between"
          >
            <span>{getRoleLabel(role)}</span>
            {role ? (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  setRole("OPERATOR");
                }}
                className="text-text-muted hover:text-text-primary"
              >
                ×
              </span>
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-text-muted" />
            )}
          </button>
          {roleOpen && (
            <div className="absolute z-10 w-full mt-1 bg-bg-secondary border border-surface-border rounded-lg shadow-lg overflow-hidden">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setRole(r.value);
                    setRoleOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-text-primary hover:bg-bg-card text-sm"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {loadingVenue && !venueId ? <p className="text-text-secondary text-sm">Загрузка площадки...</p> : null}

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
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
