import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StationAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const roomId: string | undefined = req.params?.roomId;
    if (!roomId) {
      throw new UnauthorizedException('roomId required');
    }

    const authHeader: string | undefined = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Empty token');
    }

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new ForbiddenException('Room not found');
    }
    if (!room.stationApiKeyHash) {
      throw new ForbiddenException('Station API key not configured for this room');
    }

    const ok = await bcrypt.compare(token, room.stationApiKeyHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid station credentials');
    }

    req.stationRoom = room;
    return true;
  }
}
