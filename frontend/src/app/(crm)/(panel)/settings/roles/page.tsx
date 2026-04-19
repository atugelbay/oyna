"use client";

import { useState, useEffect, useMemo } from "react";
import { settingsService } from "@/services/settings.service";
import { readApiUserError } from "@/lib/api-error-message";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { RoleLabelModal, type RoleLabelModalState } from "@/components/crm/RoleLabelModal";
import { useConfirmDelete } from "@/components/ui/ConfirmDeleteModal";

const PERMISSION_LABELS: Record<string, string> = {
  add_player: "Добавление игрока",
  add_minutes: "Добавление минут игрокам",
  rooms: "Создание/Удаление игрового зала",
  tournaments: "Создание турниров",
  add_role: "Добавление роли",
  stats: "Статистика",
};

/** Базовые подписи (без пользовательского переименования из API) */
function defaultRoleTitle(role: string): string {
  const u = role.toUpperCase();
  const m = /^CRM_EXTRA_(\d+)$/i.exec(role);
  if (m) return `Доп. роль ${m[1]}`;
  const map: Record<string, string> = {
    ADMIN: "Администратор",
    MANAGER: "Менеджер",
    OPERATOR: "Оператор",
    USER: "Таблица игроков",
  };
  return map[u] ?? role;
}

/** Отображаемое имя: своё из CRM или стандартное */
function roleDisplayName(entry: RoleData | string): string {
  const key = typeof entry === "string" ? entry : entry.role;
  const custom =
    typeof entry === "object" && entry.customLabel && String(entry.customLabel).trim()
      ? String(entry.customLabel).trim()
      : null;
  if (custom) return custom;
  return defaultRoleTitle(key);
}

type RoleData = {
  role: string;
  customLabel?: string | null;
  permissions: { permissionKey: string; enabled: boolean }[];
  accessCode?: string | { venueId?: string; code?: string };
};

function normalizeAccessCode(value: RoleData["accessCode"]): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.code === "string") return value.code;
  return "";
}

/** Администратор в UI не редактируется — выбираем первую роль из списка, доступную для настройки */
function firstSelectableRoleId(roles: RoleData[]): string | null {
  const r = roles.find((x) => x.role.toUpperCase() !== "ADMIN");
  return r?.role ?? null;
}

export default function SettingsRolesPage() {
  const { user } = useAuth();
  const isOwnerAdmin = user?.role?.toUpperCase() === "ADMIN";
  const { confirmDelete, dialog: deleteDialog } = useConfirmDelete();
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const { selectedVenueId: venueId } = useCrmVenue();
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [baselineToggles, setBaselineToggles] = useState<Record<string, boolean>>({});
  const [roleLabelModal, setRoleLabelModal] = useState<RoleLabelModalState>({ kind: "closed" });

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    settingsService
      .getRoles()
      .then((data: RoleData[]) => {
        if (cancelled) return;
        setRoles(data);
        const initialId = firstSelectableRoleId(data);
        if (initialId) {
          setSelectedRoleId(initialId);
          const initial = data.find((r) => r.role === initialId);
          if (initial) {
            const map: Record<string, boolean> = {};
            initial.permissions.forEach((p) => {
              map[p.permissionKey] = p.enabled;
            });
            setToggles(map);
            setBaselineToggles(map);
          }
        } else {
          setSelectedRoleId(null);
          setToggles({});
          setBaselineToggles({});
        }
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
  }, []);

  useEffect(() => {
    const r = roles.find((x) => x.role === selectedRoleId);
    if (r) {
      const map: Record<string, boolean> = {};
      r.permissions.forEach((p) => {
        map[p.permissionKey] = p.enabled;
      });
      setToggles(map);
      setBaselineToggles(map);
    }
  }, [selectedRoleId, roles]);

  const isPermissionsDirty = useMemo(() => {
    return JSON.stringify(toggles) !== JSON.stringify(baselineToggles);
  }, [toggles, baselineToggles]);

  function toggle(id: string) {
    setToggles((t) => ({ ...t, [id]: !t[id] }));
  }

  const selectedRole = roles.find((r) => r.role === selectedRoleId);
  const selectedIsCrmExtra = !!selectedRoleId?.startsWith("CRM_EXTRA_");
  const canEditSelectedRole =
    selectedRoleId && selectedRoleId.toUpperCase() !== "ADMIN";
  const accessCode = selectedRole?.accessCode;
  const accessCodeText = normalizeAccessCode(accessCode);
  const adminRoleEntry = roles.find((r) => r.role.toUpperCase() === "ADMIN");
  const selectableRoles = roles.filter((r) => r.role.toUpperCase() !== "ADMIN");
  /** Порядок строк как от API (бэкенд отдаёт фиксированный список CRM_PERMISSION_KEYS) */
  const permissionTemplateRole =
    selectedRole ?? selectableRoles[0] ?? roles[0];
  const permissionKeys =
    permissionTemplateRole?.permissions.map((p) => p.permissionKey) ?? [];

  function copyCode() {
    navigator.clipboard.writeText(accessCodeText);
  }

  async function reloadRoles(keepRoleId: string | null) {
    const data = await settingsService.getRoles();
    setRoles(data);

    const keep =
      keepRoleId &&
      keepRoleId.toUpperCase() !== "ADMIN" &&
      data.some((r: RoleData) => r.role === keepRoleId)
        ? keepRoleId
        : null;
    const nextRoleId = keep ?? firstSelectableRoleId(data);
    setSelectedRoleId(nextRoleId);
  }

  async function savePermissions() {
    if (saving || !selectedRoleId || selectedRoleId.toUpperCase() === "ADMIN") return;
    setActionError(null);
    setSaving(true);
    try {
      const permissions = permissionKeys.map((key) => ({
        permissionKey: key,
        enabled: !!toggles[key],
      }));
      await settingsService.updateRolePermissions(selectedRoleId, permissions);
      await reloadRoles(selectedRoleId);
    } catch (err: unknown) {
      setActionError(readApiUserError(err, "Не удалось сохранить"));
    } finally {
      setSaving(false);
    }
  }

  function openRenameModal(shell: "add" | "edit") {
    if (!selectedRoleId) return;
    const entry = roles.find((x) => x.role === selectedRoleId);
    if (!entry) return;
    setRoleLabelModal({
      kind: "rename",
      role: selectedRoleId,
      shell,
      labelSeed: roleDisplayName(entry),
      canReset: !!(entry.customLabel && String(entry.customLabel).trim()),
      systemRoleTitle: defaultRoleTitle(selectedRoleId),
    });
  }

  async function deleteSelectedCrmExtraRole() {
    if (!selectedRoleId || !selectedIsCrmExtra) return;
    const ok = await confirmDelete({
      title: "Удалить дополнительную роль?",
      message:
        "Роль исчезнет из списка; сотрудники с ней потеряют доступ, коды входа для этой роли удалятся.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    setActionError(null);
    try {
      const data = await settingsService.deleteCrmRole(selectedRoleId);
      setRoles(data as RoleData[]);
      const next = firstSelectableRoleId(data as RoleData[]);
      setSelectedRoleId(next);
    } catch (err: unknown) {
      setActionError(readApiUserError(err, "Не удалось удалить роль"));
    }
  }

  async function regenerateAccessCode() {
    if (regenerating || !selectedRoleId || selectedRoleId.toUpperCase() === "ADMIN") return;
    if (!venueId) {
      setActionError("Не выбрана площадка (venueId) для генерации кода");
      return;
    }
    setActionError(null);
    setRegenerating(true);
    try {
      await settingsService.regenerateAccessCode(selectedRoleId, venueId);
      await reloadRoles(selectedRoleId);
    } catch (err: unknown) {
      setActionError(readApiUserError(err, "Не удалось обновить код"));
    } finally {
      setRegenerating(false);
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
    <>
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 flex flex-col gap-3 self-start">
        <div className="rounded-xl overflow-hidden border border-surface-border bg-[#19232E]">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-text-secondary">Наименование</h2>
          </div>
            {adminRoleEntry ? (
            <>
              <div className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-text-primary">
                <span className="min-w-0 truncate">{roleDisplayName(adminRoleEntry)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {user?.role &&
                  adminRoleEntry.role.toUpperCase() === user.role.toUpperCase() ? (
                    <span className="text-xs text-text-muted whitespace-nowrap">Ваша роль</span>
                  ) : null}
                </div>
              </div>
              <div className="border-b border-surface-border" aria-hidden />
            </>
          ) : null}
          <ul className="flex flex-col gap-3 p-4 pt-3">
            {selectableRoles.map((r) => (
              <li key={r.role}>
                <button
                  type="button"
                  onClick={() => setSelectedRoleId(r.role)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-text-primary transition-colors bg-[#263545] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[#19232E] ${
                    selectedRoleId === r.role
                      ? "ring-2 ring-inset ring-cyan"
                      : "hover:brightness-110"
                  }`}
                >
                  <span className="min-w-0 truncate">{roleDisplayName(r)}</span>
                  <ArrowRightIcon className="w-4 h-4 text-text-muted shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        {isOwnerAdmin ? (
          <button
            type="button"
            onClick={() => setRoleLabelModal({ kind: "create" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Добавить роль
          </button>
        ) : null}
        <p className="text-xs text-text-muted leading-relaxed px-0.5">
          {isOwnerAdmin
            ? "Базовые роли (4) всегда в списке. Кнопка выше создаёт дополнительную CRM-роль со своими правами (до 5 шт.). Название строки можно менять кнопкой «Изменить»."
            : "Название строки и права настраиваются для выбранной роли (кнопка «Изменить» и переключатели справа)."}
        </p>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-text-primary">Настройки доступа</h3>
          <div className="flex flex-wrap items-center gap-2">
            {canEditSelectedRole ? (
              <>
                <button
                  type="button"
                  onClick={() => void savePermissions()}
                  disabled={saving || regenerating || !isPermissionsDirty}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/50 bg-cyan/15 px-3 py-2 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Сохранить изменения переключателей"
                >
                  <SaveIcon className="h-4 w-4" />
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => openRenameModal("edit")}
                  disabled={saving || regenerating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-bg-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary disabled:opacity-50"
                  title="Изменить отображаемое название роли"
                >
                  <PencilIcon className="h-4 w-4" />
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => openRenameModal("add")}
                  disabled={saving || regenerating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-bg-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary disabled:opacity-50"
                  title="Задать название роли (то же окно, что при добавлении)"
                >
                  <TrashIcon className="h-4 w-4" />
                  Удалить
                </button>
                {isOwnerAdmin && selectedIsCrmExtra ? (
                  <button
                    type="button"
                    onClick={() => void deleteSelectedCrmExtraRole()}
                    disabled={saving || regenerating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                    title="Удалить эту дополнительную роль из системы"
                  >
                    Удалить роль
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {actionError ? <p className="text-danger text-sm">{actionError}</p> : null}

        <div className="flex w-[388px] rounded-xl border border-surface-border bg-bg-secondary p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-semibold tracking-[0.2em] text-text-primary font-mono">
                {accessCodeText || "—"}
              </p>
              <p className="text-sm text-text-secondary mt-1">Код для входа</p>
            </div>
            <div className="flex flex-row items-start gap-8 sm:gap-10 shrink-0">
              <button
                type="button"
                onClick={() => void regenerateAccessCode()}
                disabled={regenerating || !venueId}
                className="flex flex-col items-center gap-2 text-cyan hover:opacity-90 disabled:opacity-40 text-sm font-medium"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan/35 bg-cyan/10 text-cyan">
                  <RefreshIcon className="w-5 h-5" />
                </span>
                {regenerating ? "…" : "Обновить"}
              </button>
              <button
                type="button"
                onClick={copyCode}
                className="flex flex-col items-center gap-2 text-cyan hover:opacity-90 text-sm font-medium"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan/35 bg-cyan/10 text-cyan">
                  <CopyIcon className="w-5 h-5" />
                </span>
                Копировать
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-[#19232E] overflow-hidden">
          <div className="flex flex-row items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs font-medium text-text-secondary">Наименование опции</span>
            <span className="text-xs font-medium text-text-secondary shrink-0">Статус доступности</span>
          </div>
          <ul>
            {permissionKeys.length === 0 ? (
              <li className="px-4 py-6 text-sm text-text-muted text-center">Нет опций — обновите страницу</li>
            ) : (
              permissionKeys.map((key, index) => (
                <li key={key}>
                  {index > 0 ? (
                    <div className="mx-4 border-t border-surface-border" aria-hidden />
                  ) : null}
                  <div className="flex flex-row items-center justify-between gap-3 px-4 py-3.5 min-h-[3rem] hover:bg-white/[0.03] transition-colors">
                    <span className="text-sm text-text-primary min-w-0 flex-1 pr-2 leading-snug">
                      {PERMISSION_LABELS[key] ?? key}
                    </span>
                    <PermissionSwitch
                      checked={!!toggles[key]}
                      onChange={() => toggle(key)}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>

    <RoleLabelModal
      state={roleLabelModal}
      onClose={() => setRoleLabelModal({ kind: "closed" })}
      onSaved={async () => {
        setActionError(null);
        try {
          const data = await settingsService.getRoles();
          setRoles(data);
        } catch (err: unknown) {
          setActionError(readApiUserError(err, "Не удалось обновить список ролей"));
        }
      }}
      onCrmRoleProvisioned={(createdRole, list) => {
        setActionError(null);
        setRoles(list as RoleData[]);
        setSelectedRoleId(createdRole);
      }}
    />
    {deleteDialog}
    </>
  );
}

function PermissionSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-7 w-[3.25rem] shrink-0 rounded-full border border-[#9FB4C6] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[#19232E] ${
        checked ? "bg-[#9FB4C6]" : "bg-[#141C26]"
      }`}
    >
      <span
        className={`pointer-events-none absolute top-1 left-1 block h-5 w-5 rounded-full transition-transform duration-200 ease-out ${
          checked ? "translate-x-6 bg-[#001417]" : "translate-x-0 bg-[#9FB4C6]"
        }`}
        aria-hidden
      />
    </button>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </svg>
  );
}
