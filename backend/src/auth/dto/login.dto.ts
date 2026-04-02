import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

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


