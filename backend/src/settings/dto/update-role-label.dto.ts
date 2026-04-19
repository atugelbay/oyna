import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class UpdateRoleLabelDto {
  @ApiProperty({ example: 'Старший менеджер' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(80)
  label: string;
}
