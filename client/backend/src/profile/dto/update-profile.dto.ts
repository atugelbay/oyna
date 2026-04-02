import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Иван Иванов' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'ivan_oyna' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  nickname?: string;

  @ApiPropertyOptional({ example: '2000-01-15' })
  @IsOptional()
  @IsString()
  birthDate?: string;
}
