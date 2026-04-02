import { PartialType } from '@nestjs/swagger';
import { CreateLoyaltyLevelDto } from './create-loyalty-level.dto';

export class UpdateLoyaltyLevelDto extends PartialType(CreateLoyaltyLevelDto) {}


