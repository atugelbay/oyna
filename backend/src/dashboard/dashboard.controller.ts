import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('today')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Главная: смена, брони сегодня, комнаты, важное, цифры дня' })
  today(
    @Query('venueId') venueId: string | undefined,
    @CurrentUser('id') id: string,
    @CurrentUser('role') role: Role,
  ) {
    if (!venueId) throw new BadRequestException('Выберите точку');
    return this.dashboard.today(venueId, { id, role });
  }
}
