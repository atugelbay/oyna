import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class CreatePromoDto {
  @ApiProperty({ example: 'Summer Sale' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Get 20% off' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional({ example: 'Limited time offer for all users' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'discount', description: 'Promo type' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: '20%' })
  @IsOptional()
  @IsString()
  reward?: string;

  @ApiPropertyOptional({ example: '100' })
  @IsOptional()
  @IsString()
  quantity?: string;

  @ApiProperty({ example: '2025-03-08T00:00:00.000Z', description: 'ISO 8601 date string' })
  @IsDateString()
  dateStart: string;

  @ApiPropertyOptional({ example: '2025-03-31T23:59:59.000Z', description: 'ISO 8601 date string' })
  @IsOptional()
  @IsDateString()
  dateEnd?: string;

  @ApiPropertyOptional({ example: 'uuid-of-venue' })
  @IsOptional()
  @IsUUID('loose')
  venueId?: string;
}


