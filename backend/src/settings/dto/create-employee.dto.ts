import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Иван Иванов' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'OPERATOR', enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ example: 'uuid-of-venue' })
  @IsUUID('loose')
  venueId: string;
}


