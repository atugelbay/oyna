import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current player profile' })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current player profile' })
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateMe(user.id, dto);
  }
}
