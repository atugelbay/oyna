import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsUUID, Min } from 'class-validator';

export class CreatePricePackageDto {
  @ApiProperty({ example: 'uuid-of-venue' })
  @IsUUID('loose')
  venueId: string;

  @ApiProperty({ example: '1 час игры' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 60, description: 'Duration in minutes' })
  @IsInt()
  @Min(1)
  minutes: number;

  @ApiProperty({ example: 3000, description: 'Cost in tenge' })
  @IsInt()
  @Min(0)
  costTenge: number;
}


