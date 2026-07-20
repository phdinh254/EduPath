import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@ApiTags('classes')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Roles(Role.TEACHER)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateClassDto) {
    return this.classesService.createForTeacher(user.sub, dto);
  }

  @Roles(Role.TEACHER)
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    this.assertTenant(user);
    return this.classesService.findAllForTenant(user.tenantId!);
  }

  @Roles(Role.TEACHER)
  @Get(':id/students')
  findStudents(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    this.assertTenant(user);
    return this.classesService.findStudents(id, user.tenantId!);
  }

  @Roles(Role.TEACHER)
  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateClassDto) {
    this.assertTenant(user);
    return this.classesService.update(id, user.tenantId!, dto);
  }

  @Roles(Role.TEACHER)
  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    this.assertTenant(user);
    return this.classesService.remove(id, user.tenantId!);
  }

  @Roles(Role.TEACHER)
  @Delete(':id/students/:studentId')
  removeStudent(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    this.assertTenant(user);
    return this.classesService.removeStudent(id, studentId, user.tenantId!);
  }

  @Roles(Role.STUDENT)
  @Post('join')
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinClassDto) {
    return this.classesService.joinByInviteCode(user.sub, dto.inviteCode);
  }

  @Roles(Role.STUDENT)
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.classesService.findMyClasses(user.sub);
  }

  private assertTenant(user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tài khoản giáo viên chưa có tenant');
    }
  }
}
