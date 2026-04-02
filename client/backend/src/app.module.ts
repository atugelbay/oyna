import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { BalanceModule } from './balance/balance.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { PromosModule } from './promos/promos.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { VenuesModule } from './venues/venues.module.js';
import { TournamentsModule } from './tournaments/tournaments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProfileModule,
    BalanceModule,
    SessionsModule,
    PromosModule,
    LeaderboardModule,
    VenuesModule,
    TournamentsModule,
  ],
})
export class AppModule {}
