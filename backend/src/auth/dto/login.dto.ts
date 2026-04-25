import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+77001234567', description: 'Номер телефона' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Неверный формат телефона' })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '1234', description: 'OTP код (на MVP — 1234)' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class CrmLoginDto {
  @ApiProperty({ example: '+77000000001', description: 'Телефон сотрудника' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'admin123', description: 'Пароль сотрудника' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Код доступа сотрудника' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isEmployee?: boolean;
}

