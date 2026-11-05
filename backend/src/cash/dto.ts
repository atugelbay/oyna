import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class OpenShiftDto {
  @IsUUID()
  venueId: string;

  @IsInt()
  @Min(0)
  openingCash: number;

  @IsOptional()
  @IsString()
  openingNote?: string;
}

export class CloseShiftDto {
  @IsInt()
  @Min(0)
  closingCashActual: number;

  @IsInt()
  @Min(0)
  closingKaspi: number;

  @IsInt()
  @Min(0)
  closingHalyk: number;

  @IsInt()
  @Min(0)
  closingFreedom: number;

  @IsOptional()
  @IsString()
  closeComment?: string;
}

export class SaleLineDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsInt()
  @Min(0)
  priceTenge: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minutes?: number;

  /** ITEM — плитка каталога, CERTIFICATE — сертификат на минуты плитки, BOOKING — оплата брони */
  @IsOptional()
  @IsIn(['ITEM', 'CERTIFICATE', 'BOOKING'])
  kind?: 'ITEM' | 'CERTIFICATE' | 'BOOKING';

  @IsOptional()
  @IsUUID()
  bookingId?: string;
}

export class SalePayDto {
  @IsIn(['CASH', 'KASPI', 'HALYK', 'FREEDOM'])
  method: 'CASH' | 'KASPI' | 'HALYK' | 'FREEDOM';

  @IsInt()
  @Min(1)
  amountTenge: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cashReceived?: number;
}

export class CreateSaleDto {
  @IsUUID()
  venueId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Несколько игроков в одном чеке: минуты делятся поровну */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  userIds?: string[];

  /** Продажа гостю без аккаунта: минуты не начисляются */
  @IsOptional()
  @IsBoolean()
  guest?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines: SaleLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePayDto)
  payments: SalePayDto[];

  @IsOptional()
  @IsBoolean()
  receiptChecked?: boolean;

  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  enteredAfterOutage?: boolean;
}

export class CancelSaleDto {
  @IsString()
  @IsNotEmpty({ message: 'Укажите причину' })
  reason: string;
}

export class RefundSaleDto {
  @IsInt()
  @Min(1)
  amountTenge: number;

  @IsString()
  @IsNotEmpty({ message: 'Укажите причину возврата' })
  reason: string;

  @IsIn(['CASH', 'KASPI', 'HALYK', 'FREEDOM'])
  method: 'CASH' | 'KASPI' | 'HALYK' | 'FREEDOM';
}

export class CashMoveDto {
  @IsIn(['IN', 'OUT', 'EXPENSE'])
  type: 'IN' | 'OUT' | 'EXPENSE';

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  article?: string;

  /** Обязательно: откуда/куда деньги (например, «наличные до CRM») */
  @IsString()
  @IsNotEmpty({ message: 'Напишите комментарий к движению денег' })
  comment: string;
}

export class CatalogDto {
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsString()
  name: string;

  @IsIn(['GAMES', 'PACKAGES', 'PROMO', 'WATER', 'OTHER', 'CERTIFICATE', 'BARTER'])
  category: 'GAMES' | 'PACKAGES' | 'PROMO' | 'WATER' | 'OTHER' | 'CERTIFICATE' | 'BARTER';

  @IsInt()
  @Min(0)
  priceTenge: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceWeekendTenge?: number;

  @IsOptional()
  @IsInt()
  minutes?: number;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;
}
