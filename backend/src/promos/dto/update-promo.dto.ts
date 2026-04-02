import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { CreatePromoDto } from './create-promo.dto';
import { PromoStatus } from '@prisma/client';

export class UpdatePromoDto extends PartialType(CreatePromoDto) {
  @ApiPropertyOptional({ enum: PromoStatus })
  @IsOptional()
  @IsEnum(PromoStatus)
  status?: PromoStatus;
}


