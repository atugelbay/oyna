import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Min, IsString } from 'class-validator';

export class SessionMatchReportDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  level: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  attemptNumber: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ example: '2026-04-19T15:31:48.000Z' })
  @IsOptional()
  @IsString()
  completedAt?: string;

  @ApiProperty({
    description: 'Произвольный JSON результата уровня (как в WS match_completed)',
    example: { finalScore: 1920, bVictory: true, mode: 'classic' },
  })
  @IsObject()
  result: Record<string, unknown>;
}
