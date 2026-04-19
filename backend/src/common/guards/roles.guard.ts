import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { isCrmExtraRoleName } from '../../settings/crm-extra-roles.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const u = user?.role as string | undefined;

    return requiredRoles.some((required) => {
      if (u === required) return true;
      /** Доп. CRM-роли: тот же уровень доступа, что у оператора/менеджера (матрица прав уточняется отдельно) */
      if (
        u &&
        isCrmExtraRoleName(u) &&
        (required === Role.OPERATOR || required === Role.MANAGER)
      ) {
        return true;
      }
      return false;
    });
  }
}


