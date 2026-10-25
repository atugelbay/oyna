import { IsString, IsNotEmpty, MaxLength, IsByteLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    example: "ivan_oyna",
    description: "Никнейм или номер телефона",
  })
  @IsString()
  @IsNotEmpty({ message: "Введите никнейм или номер телефона" })
  @MaxLength(100, { message: "Слишком длинный логин" })
  identifier: string;

  @ApiProperty({ description: "Пароль игрока", format: "password" })
  @IsString()
  @IsNotEmpty({ message: "Введите пароль" })
  @IsByteLength(1, 72, { message: "Пароль не должен превышать 72 байта" })
  password: string;
}
