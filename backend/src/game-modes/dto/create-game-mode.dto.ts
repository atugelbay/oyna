import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, IsObject } from 'class-validator';
import { GameModeType } from '@prisma/client';

export class CreateGameModeDto {
  @ApiProperty({ example: 'uuid-of-room' })
  @IsUUID('loose')
  roomId: string;

  @ApiProperty({ enum: GameModeType, example: 'COOP' })
  @IsEnum(GameModeType)
  type: GameModeType;

  @ApiProperty({ example: 'Кооператив' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Все игроки работают вместе' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: { speed: 1.0, difficulty: 'normal' },
    description: 'Конфигурация для UE',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}


