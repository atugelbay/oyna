import { IsString, IsNotEmpty, IsOptional, Matches, MinLength, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Некорректный формат номера телефона' })
  phone: string;

  @ApiProperty({ example: '1234', description: 'OTP code for phone verification' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  code: string;

  @ApiProperty({ example: 'ivan_oyna' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  nickname: string;

  @ApiPropertyOptional({ example: 'Иван Иванов' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: '2000-01-15' })
  @IsOptional()
  @IsString()
  birthDate?: string;
}
