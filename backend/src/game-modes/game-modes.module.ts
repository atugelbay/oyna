import { Module } from '@nestjs/common';
import { GameModesController } from './game-modes.controller';
import { GameModesService } from './game-modes.service';

@Module({
  controllers: [GameModesController],
  providers: [GameModesService],
  exports: [GameModesService],
})
export class GameModesModule {}


