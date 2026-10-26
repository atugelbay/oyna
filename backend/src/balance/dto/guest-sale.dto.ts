import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GuestSaleDto {
  @ApiProperty({ example: 3000, description: 'Сумма оплаты в тенге' })
  @IsInt()
  @Min(0)
  amountTenge: number;

  @ApiProperty({
    example: 'cash',
    enum: ['cash', 'card', 'kaspi_qr'],
  })
  @IsIn(['cash', 'card', 'kaspi_qr'])
  paymentMethod: 'cash' | 'card' | 'kaspi_qr';

  @ApiProperty({ example: 60, description: 'Минуты (учёт, без зачисления на аккаунт)' })
  @IsInt()
  @Min(1)
  minutes: number;

  @ApiProperty({ example: 'uuid-of-venue' })
  @IsUUID('loose')
  venueId: string;

  @ApiPropertyOptional({ example: '1 час' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  packageName?: string;

  @ApiPropertyOptional({ description: 'Комната (для комментария в учёте)' })
  @IsOptional()
  @IsUUID('loose')
  roomId?: string;

  @ApiPropertyOptional({ example: 'Гость', default: 'Гость' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  comment?: string;
}
