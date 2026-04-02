import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class StartSessionDto {
  @ApiProperty({ description: 'ID комнаты' })
  @IsUUID('loose')
  roomId: string;

  @ApiProperty({ description: 'ID режима игры' })
  @IsUUID('loose')
  modeId: string;

  @ApiProperty({ description: 'ID точки' })
  @IsUUID('loose')
  venueId: string;

  @ApiProperty({
    description: 'Список ID игроков',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('loose', { each: true })
  playerIds: string[];
}


