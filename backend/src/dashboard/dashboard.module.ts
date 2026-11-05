import { Module } from '@nestjs/common';
import { RatingModule } from '../rating/rating.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [RatingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
