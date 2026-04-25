import { Module, forwardRef } from '@nestjs/common';
import { StationController } from './station.controller';
import { StationService } from './station.service';
import { RoomAgentCommandsService } from './room-agent-commands.service';
import { StationAuthGuard } from './guards/station-auth.guard';
import { GameSessionsModule } from '../game-sessions/game-sessions.module';

@Module({
  imports: [forwardRef(() => GameSessionsModule)],
  controllers: [StationController],
  providers: [StationService, RoomAgentCommandsService, StationAuthGuard],
  exports: [RoomAgentCommandsService],
})
export class StationModule {}
