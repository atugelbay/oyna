import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PlayerScoreDto {
  @ApiProperty({ description: 'ID игрока' })
  @IsUUID('loose')
  userId: string;

  @ApiProperty({ example: 1500, description: 'Набранные очки' })
  @IsInt()
  @Min(0)
  score: number;
}

export class EndSessionDto {
  @ApiProperty({
    description: 'Результаты игроков',
    type: [PlayerScoreDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerScoreDto)
  results: PlayerScoreDto[];

  @ApiProperty({
    example: 180,
    description: 'Фактическая длительность сессии в секундах',
  })
  @IsInt()
  @Min(1)
  durationSeconds: number;
}


