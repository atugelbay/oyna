import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SetStationApiKeyDto {
  @ApiProperty({
    description: 'Новый плоский ключ для Room Agent (хранится только как bcrypt)',
    example: 'station_live_change_me_in_production_32chars',
  })
  @IsString()
  @MinLength(24)
  apiKey: string;
}
