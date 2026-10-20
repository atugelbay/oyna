import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';

/** Тело ≈ ответ GET /v1/catalog (+ опционально catalog_hash). */
export class UpsertRoomCatalogDto {
  @ApiProperty({ example: '1.0' })
  @IsString()
  api_version: string;

  @ApiProperty({ example: 'lasers' })
  @IsString()
  room_id: string;

  @ApiProperty({ example: '1.1' })
  @IsString()
  scoring_version: string;

  @ApiProperty({ example: 1.0 })
  @IsNumber()
  c: number;

  @ApiProperty({ example: 4 })
  @IsNumber()
  lobby_max_players: number;

  @ApiProperty({
    description: 'modes[] из Room API catalog',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  @ArrayMinSize(1)
  modes: Record<string, unknown>[];

  @ApiPropertyOptional({
    description: 'Хэш из room_online.catalog_hash',
  })
  @IsOptional()
  @IsString()
  catalog_hash?: string;

  /** прочие поля каталога не отвергаем */
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
