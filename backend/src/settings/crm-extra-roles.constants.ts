import { Role } from '@prisma/client';

/** Дополнительные CRM-роли — создаются владельцем, не фиксированы при деплое как MANAGER и т.д. */
export const CRM_EXTRA_ROLE_SLOTS: readonly Role[] = [
  Role.CRM_EXTRA_1,
  Role.CRM_EXTRA_2,
  Role.CRM_EXTRA_3,
  Role.CRM_EXTRA_4,
  Role.CRM_EXTRA_5,
];

export function isCrmExtraRoleName(role: string | Role): boolean {
  const s = typeof role === 'string' ? role : String(role);
  return s.startsWith('CRM_EXTRA_');
}
