import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PromosService } from './promos.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@ApiTags('promos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('promos')
export class PromosController {
  constructor(private promosService: PromosService) {}

  @Get()
  @ApiOperation({ summary: 'Get active promotions' })
  @ApiQuery({ name: 'venueId', required: false })
  getActivePromos(@Query('venueId') venueId?: string) {
    return this.promosService.getActivePromos(venueId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get promo by id' })
  getPromoById(@Param('id') id: string) {
    return this.promosService.getPromoById(id);
  }
}
