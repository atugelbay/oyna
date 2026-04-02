import { PartialType } from '@nestjs/swagger';
import { CreatePricePackageDto } from './create-price-package.dto';

export class UpdatePricePackageDto extends PartialType(CreatePricePackageDto) {}


