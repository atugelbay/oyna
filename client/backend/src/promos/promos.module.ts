import { Module } from '@nestjs/common';
import { PromosController } from './promos.controller.js';
import { PromosService } from './promos.service.js';

@Module({
  controllers: [PromosController],
  providers: [PromosService],
})
export class PromosModule {}
