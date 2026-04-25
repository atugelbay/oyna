import { Module, forwardRef } from '@nestjs/common';
import { GameSessionsController } from './game-sessions.controller';
import { GameSessionsService } from './game-sessions.service';
import { StationModule } from '../station/station.module';

@Module({
  imports: [forwardRef(() => StationModule)],
  controllers: [GameSessionsController],
  providers: [GameSessionsService],
  exports: [GameSessionsService],
})
export class GameSessionsModule {}


