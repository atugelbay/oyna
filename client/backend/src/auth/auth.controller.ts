import { Controller, Post, Body, HttpCode, HttpStatus, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AuthService } from "./auth.service.js";
import { RegisterDto, LoginDto, RefreshDto } from "./dto/index.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register new player" })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, clientIp(req));
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Вход по никнейму или телефону и паролю" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, clientIp(req));
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }
}

function clientIp(req: Request) {
  const remote = req.socket?.remoteAddress ?? "";
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  if (loopback) {
    const xff = req.headers["x-forwarded-for"];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    const first = raw?.split(",")[0]?.trim();
    if (first) return first;
  }
  return remote || "unknown";
}
