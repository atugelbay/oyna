import { Injectable, NotFoundException } from '@nestjs/common';
import { GameModeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameModeDto } from './dto/create-game-mode.dto';
import { UpdateGameModeDto } from './dto/update-game-mode.dto';

function sessionDurationConfig(config: unknown): {
  durationSeconds: number;
  sortOrder: number | null;
} | null {
  if (!config || typeof config !== 'object' || config === null) return null;
  const c = config as Record<string, unknown>;
  const ds = c.durationSeconds;
  if (typeof ds !== 'number' || !Number.isFinite(ds) || ds <= 0) return null;
  const so = c.sortOrder;
  const sortOrder =
    typeof so === 'number' && Number.isFinite(so) ? so : null;
  return { durationSeconds: Math.round(ds), sortOrder };
}

function hasFfaTwin(
  modes: { type: GameModeType; name: string; config: Prisma.JsonValue }[],
  name: string,
  durationSeconds: number,
  sortOrder: number | null,
): boolean {
  return modes.some((x) => {
    if (x.type !== GameModeType.FFA) return false;
    if (x.name !== name) return false;
    const sc = sessionDurationConfig(x.config);
    if (!sc || sc.durationSeconds !== durationSeconds) return false;
    if (sortOrder === null && sc.sortOrder === null) return true;
    return sc.sortOrder === sortOrder;
  });
}

@Injectable()
export class GameModesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGameModeDto) {
    return this.prisma.gameMode.create({
      data: dto,
      include: { room: true },
    });
  }

  /**
   * Для каждой «сессии» (COOP + durationSeconds в config) без пары FFA создаёт одиночный режим.
   * Так CRM может переключать «Одиночный» и для старых комнат, и если второй create не прошёл.
   */
  async findByRoom(roomId: string) {
    let modes = await this.prisma.gameMode.findMany({
      where: { roomId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    for (const m of modes) {
      if (m.type !== GameModeType.COOP) continue;
      const cfg = sessionDurationConfig(m.config);
      if (!cfg) continue;
      if (hasFfaTwin(modes, m.name, cfg.durationSeconds, cfg.sortOrder)) continue;

      await this.prisma.gameMode.create({
        data: {
          roomId,
          type: GameModeType.FFA,
          name: m.name,
          config:
            m.config === null
              ? Prisma.JsonNull
              : (m.config as Prisma.InputJsonValue),
        },
      });
      modes = await this.prisma.gameMode.findMany({
        where: { roomId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
    }

    return modes;
  }

  async findOne(id: string) {
    const mode = await this.prisma.gameMode.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!mode) throw new NotFoundException('Режим не найден');
    return mode;
  }

  async update(id: string, dto: UpdateGameModeDto) {
    await this.findOne(id);
    return this.prisma.gameMode.update({
      where: { id },
      data: dto,
      include: { room: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.gameMode.delete({ where: { id } });
  }
}


