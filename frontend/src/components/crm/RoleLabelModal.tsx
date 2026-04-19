"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Button } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { settingsService } from "@/services/settings.service";

const BASE_EDITABLE = ["MANAGER", "OPERATOR", "USER"] as const;

export type RoleLabelModalState =
  | { kind: "closed" }
  /** Владелец: создаёт новый слот CRM_EXTRA_* */
  | { kind: "create" }
  | {
      kind: "rename";
      role: string;
      shell: "add" | "edit";
      labelSeed: string;
      canReset: boolean;
      systemRoleTitle: string;
    };

interface RoleLabelModalProps {
  state: RoleLabelModalState;
  onClose: () => void;
  /** После переименования / сброса подписи */
  onSaved: () => void;
  /** После создания: обновлённый список ролей и id новой строки */
  onCrmRoleProvisioned?: (createdRole: string, roles: unknown[]) => void;
}

function canPatchLabelForRole(r: string): boolean {
  const u = r.toUpperCase();
  if (u === "ADMIN") return false;
  if (r.startsWith("CRM_EXTRA_")) return true;
  return (BASE_EDITABLE as readonly string[]).includes(u);
}

export function RoleLabelModal({
  state,
  onClose,
  onSaved,
  onCrmRoleProvisioned,
}: RoleLabelModalProps) {
  const [mounted, setMounted] = useState(false);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = state.kind !== "closed";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state.kind === "closed") return;
    setError(null);
    setSubmitting(false);
    if (state.kind === "create") {
      setLabel("");
      return;
    }
    if (state.kind === "rename") {
      setLabel(state.labelSeed);
    }
  }, [state]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (state.kind === "create") {
      void submitCreate();
      return;
    }
    if (state.kind !== "rename") return;
    void submitRename();
  }

  async function submitCreate() {
    const trimmed = String(label || "").trim();
    if (!trimmed) {
      setError("Введите название роли");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const data = await settingsService.createCrmRole(trimmed);
      const role = data?.createdRole as string | undefined;
      const list = data?.roles;
      if (role && Array.isArray(list)) {
        onCrmRoleProvisioned?.(role, list);
      } else {
        onSaved();
      }
      onClose();
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось создать роль"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRename() {
    if (state.kind !== "rename") return;
    setError(null);

    const trimmed = String(label || "").trim();
    if (!trimmed) {
      setError("Введите название роли");
      return;
    }

    const targetRole = state.role;
    if (!targetRole || !canPatchLabelForRole(targetRole)) {
      setError("Некорректная роль");
      return;
    }

    setSubmitting(true);
    try {
      await settingsService.updateRoleLabel(targetRole, trimmed);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось сохранить название"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (submitting || state.kind !== "rename") return;
    const role = state.role;
    if (!canPatchLabelForRole(role)) return;
    setError(null);
    setSubmitting(true);
    try {
      await settingsService.clearRoleLabel(role);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось сбросить название"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  if (state.kind === "create") {
    const titleId = "role-label-create-title";
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
          onClick={(ev) => ev.stopPropagation()}
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
                  Новая роль
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-text-secondary">
                  Создаётся отдельная CRM-роль со своими правами и кодом входа (не больше{" "}
                  <span className="text-text-primary font-medium">5</span> штук).
                </p>

                <Input
                  label="Наименование роли"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Например, Кассир"
                />

                {error ? <p className="text-danger text-sm">{error}</p> : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2"
                >
                  <CheckIcon />
                  {submitting ? "Создание…" : "Добавить роль"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (state.kind !== "rename") return null;

  const titleShellAdd = "Добавление роли";
  const titleRenameEdit = "Редактирование названия роли";
  const heading = state.shell === "add" ? titleShellAdd : titleRenameEdit;
  const titleId = state.shell === "add" ? "role-label-add-title" : "role-label-rename-title";
  const isExtra = state.role.startsWith("CRM_EXTRA_");

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
        onClick={(ev) => ev.stopPropagation()}
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
              <p className="text-sm text-text-secondary">
                Роль в системе:{" "}
                <span className="font-medium text-text-primary">{state.systemRoleTitle}</span>
                <span className="block pt-1 font-normal text-text-muted text-xs leading-relaxed">
                  {isExtra
                    ? "Дополнительная CRM-роль: её можно удалить кнопкой «Удалить роль» (только у владельца)."
                    : "Меняется только подпись в списке; базовый набор ролей в системе не растёт."}
                </span>
              </p>

              <Input
                label="Наименование роли"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Например, BRONZE"
              />

              {error ? <p className="text-danger text-sm">{error}</p> : null}

              <Button type="submit" disabled={submitting} className="mt-2 inline-flex w-full items-center justify-center gap-2">
                <CheckIcon />
                {submitting ? "Сохранение…" : "Сохранить"}
              </Button>

              {state.canReset ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleReset()}
                  className="text-center text-sm text-text-secondary underline-offset-2 hover:text-danger hover:underline"
                >
                  Сбросить к названию по умолчанию
                </button>
              ) : null}
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
