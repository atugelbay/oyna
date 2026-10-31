import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RatingService } from './rating.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@ApiTags('Rating')
@Controller()
export class RatingController {
  constructor(
    private rating: RatingService,
    private prisma: PrismaService,
  ) {}

  @Get('rating')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  crmRating(
    @Query('period') period?: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('room') room?: string,
    @Query('venueId') venueId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rating.board({
      period,
      date,
      month,
      year,
      room,
      venueId,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('tv/rating')
  async tv(
    @Query('point') point?: string,
    @Query('key') key?: string,
    @Query('room') room?: string,
  ) {
    if (!point || !key) return { error: 'key required' };
    const screens = await this.prisma.tvScreen.findMany({ where: { venueId: point } });
    let screen = null as (typeof screens)[number] | null;
    for (const row of screens) {
      if (await bcrypt.compare(key, row.keyHash)) {
        screen = row;
        break;
      }
    }
    if (!screen) return { error: 'forbidden' };
    const [day, month, year, kings] = await Promise.all([
      this.rating.board({ period: 'day', venueId: point, room: room || 'all', limit: screen.topN }),
      this.rating.board({ period: 'month', venueId: point, room: room || 'all', limit: screen.topN }),
      this.rating.board({ period: 'year', venueId: point, room: room || 'all', limit: screen.topN }),
      this.rating.kings({ period: 'day', venueId: point }),
    ]);
    const strip = (board: Awaited<ReturnType<RatingService['board']>>) => ({
      ...board,
      items: board.items.map(({ userId: _id, ...rest }) => rest),
    });
    return {
      seconds: screen.seconds,
      topN: screen.topN,
      sponsorOn: screen.sponsorOn,
      sponsorText: screen.sponsorText,
      ticker: screen.ticker,
      day: strip(day),
      month: strip(month),
      year: strip(year),
      kings,
      qr: 'https://oyna.pro/leaderboard',
    };
  }

  @Post('venues/:venueId/tv-key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async issueTvKey(
    @Param('venueId') venueId: string,
    @CurrentUser('id') actorId: string,
  ) {
    const key = randomBytes(24).toString('hex');
    const keyHash = await bcrypt.hash(key, 10);
    const screen = await this.prisma.tvScreen.create({
      data: { venueId, keyHash },
    });
    await this.prisma.auditLog.create({
      data: { actorId, action: 'tv_key', entity: 'tv_screen', entityId: screen.id },
    });
    return {
      url: `https://oyna.pro/tv/rating?point=${venueId}&key=${key}`,
      screenId: screen.id,
    };
  }
}
