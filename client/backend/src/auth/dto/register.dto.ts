import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
  IsByteLength,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "+77001234567" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\+7|7|8)?\d{10}$/, {
    message: "Введите номер в формате +7 700 000 00 00",
  })
  phone: string;

  @ApiProperty({
    description: "Пароль от 8 символов, не более 72 байт",
    format: "password",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: "Пароль должен содержать минимум 8 символов" })
  @IsByteLength(1, 72, { message: "Пароль не должен превышать 72 байта" })
  password: string;

  @ApiProperty({ example: "ivan_oyna" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[a-zA-Z])[a-zA-Z0-9_]{3,32}$/, {
    message:
      "Никнейм: 3–32 символа, латиница, цифры и _. Добавьте хотя бы одну букву",
  })
  nickname: string;

  @ApiPropertyOptional({ example: "Иван Иванов" })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Имя должно содержать минимум 2 символа" })
  @MaxLength(60, { message: "Имя не должно превышать 60 символов" })
  name?: string;

  @ApiPropertyOptional({ example: "2000-01-15" })
  @IsOptional()
  @IsDateString({}, { message: "Укажите корректную дату рождения" })
  birthDate?: string;
}
