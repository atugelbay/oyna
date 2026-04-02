import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { VenueStatus } from '@prisma/client';

export class CreateVenueDto {
  @ApiProperty({ example: 'Forum Almaty' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Алматы' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'ул. Сейфуллина 617' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ example: 'Asia/Almaty' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: VenueStatus })
  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;
}


