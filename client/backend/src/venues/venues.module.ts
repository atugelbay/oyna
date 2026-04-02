import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
