import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { LedgerModule } from '../ledger/ledger.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [LedgerModule, TeamModule],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
