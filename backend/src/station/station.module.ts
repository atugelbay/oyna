import { Module, forwardRef } from '@nestjs/common';
import { StationController } from './station.controller';
import { StationService } from './station.service';
import { RoomAgentCommandsService } from './room-agent-commands.service';
import { LobbyQrService } from './lobby-qr.service';
import { HallRecordsService } from './hall-records.service';
import { PlayerLobbyService } from './player-lobby.service';
import { StationAuthGuard } from './guards/station-auth.guard';
import { GameSessionsModule } from '../game-sessions/game-sessions.module';
import { RatingModule } from '../rating/rating.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [forwardRef(() => GameSessionsModule), RatingModule, LoyaltyModule],
  controllers: [StationController],
  providers: [
    StationService,
    RoomAgentCommandsService,
    LobbyQrService,
    HallRecordsService,
    PlayerLobbyService,
    StationAuthGuard,
  ],
  exports: [
    RoomAgentCommandsService,
    LobbyQrService,
    HallRecordsService,
    PlayerLobbyService,
  ],
})
export class StationModule {}
