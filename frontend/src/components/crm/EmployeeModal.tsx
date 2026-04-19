"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Button, PhoneInput } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { settingsService } from "@/services/settings.service";
import { venuesService } from "@/services/venues.service";
import { useCrmVenue } from "@/lib/venue-context";

export type EmployeeModalState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; employee: { id: string; name: string; phone: string; role: string } };

type EmployeeRole = "OPERATOR" | "MANAGER";

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "OPERATOR", label: "Оператор" },
  { value: "MANAGER", label: "Менеджер" },
];

function normalizeRole(r: string): EmployeeRole {
  return r?.toUpperCase() === "MANAGER" ? "MANAGER" : "OPERATOR";
}

interface EmployeeModalProps {
  state: EmployeeModalState;
  onClose: () => void;
  onSaved?: () => void;
}

export function EmployeeModal({ state, onClose, onSaved }: EmployeeModalProps) {
  const { selectedVenueId: contextVenueId } = useCrmVenue();

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<EmployeeRole>("OPERATOR");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = state.kind !== "closed";
  const mode = state.kind === "add" ? "add" : state.kind === "edit" ? "edit" : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state.kind === "closed") return;
    setError(null);
    setSubmitting(false);

    if (state.kind === "add") {
      setName("");
      setPhone("");
      setRole("OPERATOR");
      return;
    }

    if (state.kind === "edit") {
      const e = state.employee;
      setName(e.name ?? "");
      setRole(normalizeRole(e.role));
    }
  }, [state]);

  useEffect(() => {
    if (state.kind !== "add") return;

    if (contextVenueId) {
      setVenueId(contextVenueId);
      setLoadingVenue(false);
      return;
    }

    let cancelled = false;
    setLoadingVenue(true);
    setVenueId(null);
    venuesService
      .list()
      .then((venues: { id: string }[]) => {
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
  }, [state.kind, contextVenueId]);

  const editPhone = state.kind === "edit" ? state.employee.phone : "";

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting || !mode) return;
    setError(null);

    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      setError("Введите имя сотрудника");
      return;
    }

    if (mode === "add") {
      const phoneDigits = String(phone || "").replace(/\D/g, "");
      const subscriber = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
      const phoneE164 = subscriber.length === 10 ? `+7${subscriber}` : "";

      if (!phoneE164) {
        setError("Проверьте номер телефона");
        return;
      }
      if (!venueId) {
        setError("Нет доступной площадки. Выберите точку в шапке или добавьте площадку.");
        return;
      }

      setSubmitting(true);
      settingsService
        .createEmployee({
          phone: phoneE164,
          name: trimmedName,
          role,
          venueId,
        })
        .then(() => {
          onSaved?.();
          onClose();
        })
        .catch((err: unknown) => {
          setError(readApiUserError(err, "Не удалось создать сотрудника"));
        })
        .finally(() => setSubmitting(false));
      return;
    }

    if (mode === "edit" && state.kind === "edit") {
      setSubmitting(true);
      settingsService
        .updateEmployee(state.employee.id, { name: trimmedName, role })
        .then(() => {
          onSaved?.();
          onClose();
        })
        .catch((err: unknown) => {
          setError(readApiUserError(err, "Не удалось сохранить"));
        })
        .finally(() => setSubmitting(false));
    }
  }

  if (!mounted || !isOpen || !mode) return null;

  const titleId = mode === "add" ? "employee-add-title" : "employee-edit-title";
  const heading = mode === "add" ? "Добавление сотрудника" : "Редактирование сотрудника";
  const submitLabel =
    submitting ? (mode === "add" ? "Создание..." : "Сохранение...") : mode === "add" ? "Добавить" : "Сохранить";

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
              <Input label="Имя сотрудника" value={name} onChange={(e) => setName(e.target.value)} />

              {mode === "add" ? (
                <>
                  <PhoneInput label="Номер телефона" value={phone} onChange={setPhone} />
                  {loadingVenue && !venueId ? (
                    <p className="text-sm text-text-secondary">Загрузка площадки…</p>
                  ) : null}
                </>
              ) : (
                <div>
                  <label className="mb-2 block text-sm text-text-secondary">Номер телефона</label>
                  <p className="rounded-lg border border-surface-border bg-[#1F2B38] px-4 py-3 text-sm text-text-primary">
                    {editPhone || "—"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">Номер нельзя изменить</p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Роль сотрудника</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as EmployeeRole)}
                  className="h-14 w-full cursor-pointer rounded-lg border border-surface-border bg-[#1F2B38] px-4 text-sm text-text-primary outline-none transition-colors focus:border-cyan focus:shadow-[0_0_0_1px_rgba(0,229,255,0.3)]"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {error ? <p className="text-danger text-sm">{error}</p> : null}

              <Button type="submit" disabled={submitting} className="mt-2 inline-flex w-full items-center justify-center gap-2">
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
