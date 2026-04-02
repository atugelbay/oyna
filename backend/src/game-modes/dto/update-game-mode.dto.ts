import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateGameModeDto } from './create-game-mode.dto';

export class UpdateGameModeDto extends PartialType(
  OmitType(CreateGameModeDto, ['roomId'] as const),
) {}


