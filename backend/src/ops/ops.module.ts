import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { LedgerModule } from '../ledger/ledger.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [LedgerModule, LoyaltyModule],
  controllers: [OpsController],
  providers: [OpsService],
  exports: [OpsService],
})
export class OpsModule {}
