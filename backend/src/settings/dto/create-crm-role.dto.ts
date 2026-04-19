import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCrmRoleDto {
  @ApiProperty({ example: 'Кассир (ночная)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(80)
  label: string;
}
