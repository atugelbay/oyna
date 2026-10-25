import { IsString, IsOptional, MinLength, Matches } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "Иван Иванов" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: "ivan_oyna" })
  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[a-zA-Z])[a-zA-Z0-9_]{3,32}$/, {
    message:
      "Никнейм: 3–32 символа, латиница, цифры и _. Добавьте хотя бы одну букву",
  })
  nickname?: string;

  @ApiPropertyOptional({ example: "2000-01-15" })
  @IsOptional()
  @IsString()
  birthDate?: string;
}
