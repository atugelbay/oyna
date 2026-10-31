import { Module, forwardRef } from '@nestjs/common';
import { GameSessionsController } from './game-sessions.controller';
import { GameSessionsService } from './game-sessions.service';
import { StationModule } from '../station/station.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [forwardRef(() => StationModule), LedgerModule, LoyaltyModule],
  controllers: [GameSessionsController],
  providers: [GameSessionsService],
  exports: [GameSessionsService],
})
export class GameSessionsModule {}


