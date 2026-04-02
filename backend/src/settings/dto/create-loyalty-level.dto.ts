import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateLoyaltyLevelDto {
  @ApiProperty({ example: 'Silver' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  minPoints: number;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @IsInt()
  bonusMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colorGradient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colorBg?: string;
}


