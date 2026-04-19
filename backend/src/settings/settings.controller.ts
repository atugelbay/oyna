import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import {
  CreatePricePackageDto,
  CreateLoyaltyLevelDto,
  CreateEmployeeDto,
  UpdatePricePackageDto,
  UpdateLoyaltyLevelDto,
  UpdateEmployeeDto,
  UpdateRolePermissionsDto,
  UpdateRoleLabelDto,
  CreateCrmRoleDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  // ─── Price Packages ─────────────────────────────────────────

  @Get('price-packages')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'List price packages' })
  getPricePackages(@Query('venueId') venueId?: string) {
    return this.settingsService.getPricePackages(venueId);
  }

  @Post('price-packages')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create price package' })
  createPricePackage(@Body() dto: CreatePricePackageDto) {
    return this.settingsService.createPricePackage(dto);
  }

  @Patch('price-packages/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update price package' })
  updatePricePackage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricePackageDto,
  ) {
    return this.settingsService.updatePricePackage(id, dto);
  }

  @Delete('price-packages/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete price package' })
  deletePricePackage(@Param('id', ParseUUIDPipe) id: string) {
    return this.settingsService.deletePricePackage(id);
  }

  // ─── Loyalty Levels ─────────────────────────────────────────

  @Get('loyalty-levels')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'List loyalty levels' })
  getLoyaltyLevels() {
    return this.settingsService.getLoyaltyLevels();
  }

  @Post('loyalty-levels')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create loyalty level' })
  createLoyaltyLevel(@Body() dto: CreateLoyaltyLevelDto) {
    return this.settingsService.createLoyaltyLevel(dto);
  }

  @Patch('loyalty-levels/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update loyalty level' })
  updateLoyaltyLevel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoyaltyLevelDto,
  ) {
    return this.settingsService.updateLoyaltyLevel(id, dto);
  }

  @Delete('loyalty-levels/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete loyalty level' })
  deleteLoyaltyLevel(@Param('id', ParseUUIDPipe) id: string) {
    return this.settingsService.deleteLoyaltyLevel(id);
  }

  // ─── Roles & Permissions ─────────────────────────────────────

  @Get('roles')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get roles with permissions and access codes' })
  getRoles() {
    return this.settingsService.getRoles();
  }

  @Post('roles')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Create additional CRM role (dedicated slot, up to 5)',
  })
  createCrmRole(@Body() dto: CreateCrmRoleDto) {
    return this.settingsService.createCrmRole(dto.label);
  }

  @Delete('roles/:role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete additional CRM role (CRM_EXTRA_* only)' })
  deleteCrmRole(@Param('role') role: Role) {
    return this.settingsService.deleteCrmRole(role);
  }

  @Patch('roles/:role/label')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Set custom CRM display name for role (enum value unchanged)' })
  updateRoleLabel(
    @Param('role') role: Role,
    @Body() dto: UpdateRoleLabelDto,
  ) {
    return this.settingsService.updateRoleLabel(role, dto.label);
  }

  @Delete('roles/:role/label')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reset role display name to default' })
  clearRoleLabel(@Param('role') role: Role) {
    return this.settingsService.deleteRoleLabel(role);
  }

  @Patch('roles/:role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update role permissions' })
  updateRolePermissions(
    @Param('role') role: Role,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.settingsService.updateRolePermissions(role, dto.permissions);
  }

  @Post('roles/:role/regenerate-code')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Regenerate access code for role' })
  regenerateAccessCode(
    @Param('role') role: Role,
    @Body('venueId') bodyVenueId?: string,
    @Query('venueId') queryVenueId?: string,
  ) {
    const venueId = bodyVenueId ?? queryVenueId;
    if (!venueId) {
      throw new BadRequestException('venueId is required (body or query)');
    }
    return this.settingsService.regenerateAccessCode(role, venueId);
  }

  // ─── Employees ───────────────────────────────────────────────

  @Get('employees')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'List employees' })
  getEmployees(@Query('venueId') venueId?: string) {
    return this.settingsService.getEmployees(venueId);
  }

  @Post('employees')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create employee' })
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.settingsService.createEmployee(dto);
  }

  @Patch('employees/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update employee' })
  updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.settingsService.updateEmployee(id, dto);
  }

  @Delete('employees/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete employee (soft delete)' })
  deleteEmployee(@Param('id', ParseUUIDPipe) id: string) {
    return this.settingsService.deleteEmployee(id);
  }
}


