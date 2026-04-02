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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PromosService } from './promos.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';

@ApiTags('Promos')
@Controller('promos')
export class PromosController {
  constructor(private promosService: PromosService) {}

  @Get()
  @ApiOperation({ summary: 'List promos (public)' })
  findAll(
    @Query('venueId') venueId?: string,
    @Query('status') status?: string,
  ) {
    return this.promosService.findAll({ venueId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get promo by id (public)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.promosService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create promo' })
  create(@Body() dto: CreatePromoDto) {
    return this.promosService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update promo' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoDto,
  ) {
    return this.promosService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete promo (admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promosService.remove(id);
  }
}


