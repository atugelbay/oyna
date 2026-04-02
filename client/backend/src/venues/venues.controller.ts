import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VenuesService } from './venues.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@ApiTags('venues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('venues')
export class VenuesController {
  constructor(private venuesService: VenuesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active venues' })
  getVenues() {
    return this.venuesService.getVenues();
  }
}
