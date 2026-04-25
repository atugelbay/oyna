import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class StationHeartbeatDto {
  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  buildVersion?: string;

  @ApiPropertyOptional({ example: 3600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  uptimeSeconds?: number;

  @ApiPropertyOptional({ description: 'Текущая сессия или null' })
  @IsOptional()
  @IsUUID('loose')
  currentSessionId?: string;
}
