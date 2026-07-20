import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query('role') role?: Role) {
    return this.usersService.findAll(role);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  setActive(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.setActive(id, dto.isActive);
  }
}
