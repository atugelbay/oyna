import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ActivateByTokenDto {
  @ApiProperty({ description: 'sessionToken сессии в этой комнате' })
  @IsUUID('loose')
  sessionToken: string;
}
