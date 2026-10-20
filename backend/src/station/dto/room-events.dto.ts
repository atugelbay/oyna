import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Одно событие журнала Room API v1 (envelope). */
export class RoomApiEventDto {
  @ApiProperty({ example: '1.0' })
  @IsString()
  api_version: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  cursor: number;

  @ApiProperty({ example: '7043cac8-e7fe-4a07-93c9-0576c2106683' })
  @IsString()
  event_id: string;

  @ApiProperty({
    enum: [
      'room_online',
      'room_status',
      'lobby_changed',
      'session_started',
      'level_finished',
      'session_finished',
    ],
  })
  @IsString()
  type: string;

  @ApiProperty({ example: '2026-10-08T14:03:21.412Z' })
  @IsString()
  ts: string;

  @ApiProperty({ example: 'forum' })
  @IsString()
  point_id: string;

  @ApiProperty({ example: 'lasers' })
  @IsString()
  room_id: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  seq?: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload: Record<string, unknown>;
}

export class IngestRoomEventsDto {
  @ApiProperty({ type: [RoomApiEventDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RoomApiEventDto)
  events: RoomApiEventDto[];
}
