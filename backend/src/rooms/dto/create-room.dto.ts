import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, Min } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'uuid-of-venue' })
  @IsUUID('loose')
  venueId: string;

  @ApiProperty({ example: 'Mega Grid' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'grid', description: 'Тип комнаты (grid, arena, laser, hideseek)' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlayers?: number;

  @ApiPropertyOptional({ example: 120, description: 'Длительность уровня по умолчанию (сек)' })
  @IsOptional()
  @IsInt()
  @Min(10)
  defaultLevelDuration?: number;
}


