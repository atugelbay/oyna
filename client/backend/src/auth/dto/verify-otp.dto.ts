import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Некорректный формат номера телефона' })
  phone: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  code: string;
}
