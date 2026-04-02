import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { Roles, CurrentUser } from '../common/decorators';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Профиль текущего пользователя' })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get('stats')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Статистика игроков (newToday, birthdaysToday)' })
  @ApiQuery({ name: 'venueId', required: false })
  getStats(@Query('venueId') venueId?: string) {
    return this.usersService.getStats(venueId);
  }

  @Get('search')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Поиск пользователей по телефону/имени/нику' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'newToday | birthdayToday',
  })
  search(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: string,
  ) {
    const allowed = filter === 'newToday' || filter === 'birthdayToday' ? filter : undefined;
    return this.usersService.search(
      q || '',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      allowed,
    );
  }

  @Get(':id')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Профиль пользователя по ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Редактирование пользователя (менеджер/админ)' })
  @ApiResponse({ status: 200, description: 'Обновлено' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }
}


