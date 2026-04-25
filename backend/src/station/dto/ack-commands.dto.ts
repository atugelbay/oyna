import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AckCommandsDto {
  @ApiProperty({ type: [String], description: 'ID команд из GET /commands' })
  @IsArray()
  @IsUUID('loose', { each: true })
  commandIds: string[];
}
