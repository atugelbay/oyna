import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, IsOptional, IsString } from 'class-validator';

export class TopupDto {
  @ApiProperty({ description: 'ID пользователя' })
  @IsUUID('loose')
  userId: string;

  @ApiProperty({ example: 1200, description: 'Количество секунд (20 мин = 1200)' })
  @IsInt()
  @Min(60)
  seconds: number;

  @ApiPropertyOptional({
    example: 600,
    description:
      'Секунды, начисленные бонусом (акции, уровень), без оплаты. Остальное уходит в PURCHASE.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bonusSeconds?: number;

  @ApiProperty({ example: 5000, description: 'Сумма в тенге' })
  @IsInt()
  @Min(0)
  amountTenge: number;

  @ApiPropertyOptional({ description: 'ID точки (если оффлайн)' })
  @IsOptional()
  @IsUUID('loose')
  venueId?: string;

  @ApiPropertyOptional({ example: 'Пополнение через кассу' })
  @IsOptional()
  @IsString()
  description?: string;
}


