import { Module } from '@nestjs/common';
import { MinuteLedgerService } from './minute-ledger.service';

@Module({
  providers: [MinuteLedgerService],
  exports: [MinuteLedgerService],
})
export class LedgerModule {}
