import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '+77001234567', description: 'Номер телефона' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Неверный формат телефона' })
  phone: string;

  @ApiProperty({ example: 'PlayerOne', description: 'Уникальный ник' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(30)
  nickname: string;

  @ApiProperty({ example: 'Азамат Нурланов', description: 'ФИО' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: '2000-05-15',
    description: 'Дата рождения',
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;
}


