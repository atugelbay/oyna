import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class CreateTournamentDto {
  @ApiProperty({ example: 'Laser Championship 2025' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Annual laser tag championship' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-of-venue' })
  @IsUUID('loose')
  venueId: string;

  @ApiProperty({ example: '2025-06-01T10:00:00.000Z' })
  @IsDateString()
  dateStart: string;

  @ApiProperty({ example: '2025-06-02T18:00:00.000Z' })
  @IsDateString()
  dateEnd: string;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeams?: number;
}


