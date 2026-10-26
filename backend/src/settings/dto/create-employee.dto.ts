import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Иван Иванов' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'OPERATOR', enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ example: 'uuid-of-venue' })
  @IsUUID('loose')
  venueId: string;

  @ApiPropertyOptional({
    example: 'StrongPass123',
    description: 'Обязателен для роли ADMIN (вход во вкладке «Владелец»)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}


