import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePricePackageDto,
  CreateLoyaltyLevelDto,
  CreateEmployeeDto,
  UpdatePricePackageDto,
  UpdateLoyaltyLevelDto,
  UpdateEmployeeDto,
} from './dto';
import { normalizeKzPhone, isKzPhoneE164 } from '../common/utils/phone.util';
import {
  CRM_EXTRA_ROLE_SLOTS,
  isCrmExtraRoleName,
} from './crm-extra-roles.constants';

/** Ключи прав CRM (порядок = порядок в UI). При отсутствии строки в БД считаем право включённым. */
export const CRM_PERMISSION_KEYS: readonly string[] = [
  'add_player',
  'add_minutes',
  'rooms',
  'tournaments',
  'add_role',
  'stats',
];

const BASE_ROLES_UI_ORDER: Role[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.OPERATOR,
  Role.USER,
];

const ROLES_UI_ORDER: Role[] = [
  ...BASE_ROLES_UI_ORDER,
  ...CRM_EXTRA_ROLE_SLOTS,
];

const EMPLOYEE_ASSIGNABLE_ROLES: Role[] = [
  Role.OPERATOR,
  Role.MANAGER,
  ...CRM_EXTRA_ROLE_SLOTS,
];

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // ─── Price Packages ─────────────────────────────────────────

  async getPricePackages(venueId?: string) {
    return this.prisma.pricePackage.findMany({
      where: venueId ? { venueId } : undefined,
      include: { venue: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPricePackage(dto: CreatePricePackageDto) {
    return this.prisma.pricePackage.create({
      data: dto,
      include: { venue: true },
    });
  }

  async updatePricePackage(id: string, dto: UpdatePricePackageDto) {
    await this.findPricePackageOrThrow(id);
    return this.prisma.pricePackage.update({
      where: { id },
      data: dto,
      include: { venue: true },
    });
  }

  async deletePricePackage(id: string) {
    await this.findPricePackageOrThrow(id);
    return this.prisma.pricePackage.delete({ where: { id } });
  }

  private async findPricePackageOrThrow(id: string) {
    const pkg = await this.prisma.pricePackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Price package not found');
    return pkg;
  }

  // ─── Loyalty Levels ─────────────────────────────────────────

  async getLoyaltyLevels() {
    return this.prisma.loyaltyLevel.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createLoyaltyLevel(dto: CreateLoyaltyLevelDto) {
    const count = await this.prisma.loyaltyLevel.count();
    return this.prisma.loyaltyLevel.create({
      data: {
        ...dto,
        bonusMinutes: dto.bonusMinutes ?? 0,
        colorGradient: dto.colorGradient ?? '',
        colorBg: dto.colorBg ?? '',
        sortOrder: count,
      },
    });
  }

  async updateLoyaltyLevel(id: string, dto: UpdateLoyaltyLevelDto) {
    await this.findLoyaltyLevelOrThrow(id);
    return this.prisma.loyaltyLevel.update({
      where: { id },
      data: dto,
    });
  }

  async deleteLoyaltyLevel(id: string) {
    await this.findLoyaltyLevelOrThrow(id);
    return this.prisma.loyaltyLevel.delete({ where: { id } });
  }

  private async findLoyaltyLevelOrThrow(id: string) {
    const level = await this.prisma.loyaltyLevel.findUnique({ where: { id } });
    if (!level) throw new NotFoundException('Loyalty level not found');
    return level;
  }

  // ─── Roles & Permissions ─────────────────────────────────────

  async getRoles() {
    const [permissions, accessCodes, customLabels, provisionedExtras] =
      await Promise.all([
        this.prisma.rolePermission.findMany(),
        this.prisma.venueAccessCode.findMany(),
        this.prisma.roleCustomLabel.findMany(),
        this.prisma.crmProvisionedRole.findMany({ select: { role: true } }),
      ]);
    const provisionedSet = new Set(provisionedExtras.map((p) => p.role));
    const labelByRole = new Map(
      customLabels.map((c) => [c.role, c.label] as const),
    );

    const visibleRoles = ROLES_UI_ORDER.filter((role) => {
      if (CRM_EXTRA_ROLE_SLOTS.includes(role)) return provisionedSet.has(role);
      return true;
    });

    return visibleRoles.map((role) => {
      const rolePerms = permissions.filter((p) => p.role === role);
      const byKey = new Map(
        rolePerms.map((p) => [p.permissionKey, p.enabled] as const),
      );
      const permissionsList = CRM_PERMISSION_KEYS.map((permissionKey) => ({
        permissionKey,
        enabled: byKey.has(permissionKey)
          ? (byKey.get(permissionKey) as boolean)
          : true,
      }));
      const accessCode = accessCodes.find((a) => a.role === role);
      return {
        role,
        customLabel: labelByRole.get(role) ?? null,
        permissions: permissionsList,
        accessCode: accessCode
          ? { venueId: accessCode.venueId, code: accessCode.code }
          : undefined,
      };
    });
  }

  async createCrmRole(label: string) {
    const trimmed = label.trim();
    if (!trimmed) {
      throw new BadRequestException('Укажите название роли');
    }

    const used = await this.prisma.crmProvisionedRole.findMany({
      select: { role: true },
    });
    const usedSet = new Set(used.map((u) => u.role));
    const nextSlot = CRM_EXTRA_ROLE_SLOTS.find((r) => !usedSet.has(r));
    if (!nextSlot) {
      throw new BadRequestException(
        'Достигнут лимит дополнительных ролей (5). Удалите неиспользуемую, чтобы добавить новую.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.crmProvisionedRole.create({ data: { role: nextSlot } }),
      this.prisma.roleCustomLabel.create({
        data: { role: nextSlot, label: trimmed },
      }),
      ...CRM_PERMISSION_KEYS.map((permissionKey) =>
        this.prisma.rolePermission.upsert({
          where: {
            role_permissionKey: { role: nextSlot, permissionKey },
          },
          create: {
            role: nextSlot,
            permissionKey,
            enabled: false,
          },
          update: {},
        }),
      ),
    ]);

    const roles = await this.getRoles();
    return { createdRole: nextSlot, roles };
  }

  async deleteCrmRole(role: Role) {
    if (!isCrmExtraRoleName(role)) {
      throw new BadRequestException('Удалить можно только дополнительную CRM-роль');
    }
    const p = await this.prisma.crmProvisionedRole.findUnique({
      where: { role },
    });
    if (!p) {
      throw new NotFoundException('Роль не найдена');
    }

    await this.prisma.$transaction([
      this.prisma.crmProvisionedRole.delete({ where: { role } }),
      this.prisma.roleCustomLabel.deleteMany({ where: { role } }),
      this.prisma.rolePermission.deleteMany({ where: { role } }),
      this.prisma.venueAccessCode.deleteMany({ where: { role } }),
    ]);

    return this.getRoles();
  }

  private async assertCrmExtraProvisioned(role: Role): Promise<void> {
    if (!isCrmExtraRoleName(role)) return;
    const p = await this.prisma.crmProvisionedRole.findUnique({
      where: { role },
    });
    if (!p) {
      throw new NotFoundException('Дополнительная роль не найдена');
    }
  }

  async updateRoleLabel(role: Role, label: string) {
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    await this.assertCrmExtraProvisioned(role);
    const trimmed = label.trim();
    if (!trimmed) {
      throw new BadRequestException('Укажите название роли');
    }
    await this.prisma.roleCustomLabel.upsert({
      where: { role },
      create: { role, label: trimmed },
      update: { label: trimmed },
    });
    return this.getRoles();
  }

  async deleteRoleLabel(role: Role) {
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    await this.assertCrmExtraProvisioned(role);
    await this.prisma.roleCustomLabel.deleteMany({ where: { role } });
    return this.getRoles();
  }

  async updateRolePermissions(
    role: Role,
    permissions: { permissionKey: string; enabled: boolean }[],
  ) {
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    await this.assertCrmExtraProvisioned(role);

    const allowed = new Set(CRM_PERMISSION_KEYS);
    for (const p of permissions) {
      if (!allowed.has(p.permissionKey)) {
        throw new BadRequestException(
          `Неизвестное право: ${p.permissionKey}`,
        );
      }
    }

    await this.prisma.$transaction(
      permissions.map((p) =>
        this.prisma.rolePermission.upsert({
          where: {
            role_permissionKey: { role, permissionKey: p.permissionKey },
          },
          create: {
            role,
            permissionKey: p.permissionKey,
            enabled: p.enabled,
          },
          update: { enabled: p.enabled },
        }),
      ),
    );

    return this.getRoles().then((roles) =>
      roles.find((r) => r.role === role),
    );
  }

  async regenerateAccessCode(role: Role, venueId: string) {
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    await this.assertCrmExtraProvisioned(role);

    const code = this.generateAlphanumericCode(6);
    const accessCode = await this.prisma.venueAccessCode.upsert({
      where: {
        venueId_role: { venueId, role },
      },
      create: { venueId, role, code },
      update: { code },
    });

    return { code: accessCode.code, venueId: accessCode.venueId };
  }

  private generateAlphanumericCode(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  // ─── Employees ───────────────────────────────────────────────

  async getEmployees(venueId?: string) {
    const where: {
      role: { in: Role[] };
      isActive: boolean;
      staffVenues?: { some: { venueId: string } };
    } = {
      role: { in: EMPLOYEE_ASSIGNABLE_ROLES },
      isActive: true,
    };
    if (venueId) {
      where.staffVenues = { some: { venueId } };
    }

    return this.prisma.user.findMany({
      where,
      include: {
        staffVenues: { include: { venue: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEmployee(dto: CreateEmployeeDto) {
    if (!EMPLOYEE_ASSIGNABLE_ROLES.includes(dto.role)) {
      throw new BadRequestException('Недопустимая роль сотрудника');
    }

    const phoneNorm = normalizeKzPhone(dto.phone);
    if (!isKzPhoneE164(phoneNorm)) {
      throw new BadRequestException('Некорректный номер телефона');
    }

    const existing = await this.prisma.user.findUnique({
      where: { phone: phoneNorm },
    });
    if (existing) {
      throw new ConflictException('User with this phone already exists');
    }

    const nickname = await this.generateUniqueNickname(phoneNorm);
    const passwordHash = null;

    const user = await this.prisma.user.create({
      data: {
        phone: phoneNorm,
        nickname,
        name: dto.name,
        role: dto.role,
        passwordHash,
        staffVenues: {
          create: { venueId: dto.venueId },
        },
      },
      include: {
        staffVenues: { include: { venue: true } },
      },
    });

    return user;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        role: { in: EMPLOYEE_ASSIGNABLE_ROLES },
      },
    });
    if (!user) {
      throw new NotFoundException('Employee not found');
    }

    const updateData: { name?: string; role?: Role } = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.role !== undefined) {
      if (!EMPLOYEE_ASSIGNABLE_ROLES.includes(dto.role)) {
        throw new BadRequestException('Недопустимая роль сотрудника');
      }
      updateData.role = dto.role;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        staffVenues: { include: { venue: true } },
      },
    });
  }

  async deleteEmployee(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        role: { in: EMPLOYEE_ASSIGNABLE_ROLES },
      },
    });
    if (!user) {
      throw new NotFoundException('Employee not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async generateUniqueNickname(phone: string): Promise<string> {
    const base = `staff_${phone.replace(/\D/g, '')}`;
    let nickname = base;
    let attempt = 0;
    while (await this.prisma.user.findUnique({ where: { nickname } })) {
      attempt++;
      nickname = `${base}_${attempt}`;
    }
    return nickname;
  }
}


