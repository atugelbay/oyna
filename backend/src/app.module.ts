import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VenuesModule } from './venues/venues.module';
import { RoomsModule } from './rooms/rooms.module';
import { GameModesModule } from './game-modes/game-modes.module';
import { BalanceModule } from './balance/balance.module';
import { TransactionsModule } from './transactions/transactions.module';
import { GameSessionsModule } from './game-sessions/game-sessions.module';
import { ScoresModule } from './scores/scores.module';
import { PromosModule } from './promos/promos.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { StatsModule } from './stats/stats.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    VenuesModule,
    RoomsModule,
    GameModesModule,
    BalanceModule,
    TransactionsModule,
    GameSessionsModule,
    ScoresModule,
    PromosModule,
    TournamentsModule,
    StatsModule,
    SettingsModule,
  ],
})
export class AppModule {}


