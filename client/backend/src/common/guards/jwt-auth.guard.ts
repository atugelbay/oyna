import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-client') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Требуется авторизация');
    }
    return user;
  }
}
