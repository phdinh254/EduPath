import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Roles(Role.TEACHER)
  @Post()
  @ApiOperation({
    summary: 'Tạo lớp học mới',
    description:
      'Chỉ TEACHER. Lớp thuộc tenant của giáo viên đang đăng nhập. isPublic=true để lớp xuất hiện trong danh sách công khai.',
  })
  @ApiResponse({
    status: 201,
    description: 'Đã tạo lớp, kèm inviteCode để mời học sinh.',
  })
  @ApiResponse({ status: 403, description: 'Không phải TEACHER.' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateClassDto) {
    return this.classesService.createForTeacher(user.sub, dto);
  }

  @Roles(Role.TEACHER)
  @Get()
  @ApiOperation({
    summary: 'Danh sách lớp của tenant hiện tại',
    description: 'Chỉ TEACHER, giới hạn trong tenant của họ.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách lớp thuộc tenant.' })
  @ApiResponse({
    status: 403,
    description: 'Không phải TEACHER hoặc chưa có tenant.',
  })
  findAll(@CurrentUser() user: JwtPayload) {
    this.assertTenant(user);
    return this.classesService.findAllForTenant(user.tenantId!);
  }

  @Roles(Role.TEACHER)
  @Get(':id/students')
  @ApiOperation({
    summary: 'Danh sách học sinh trong lớp',
    description: 'Chỉ TEACHER sở hữu lớp (cùng tenant).',
  })
  @ApiParam({ name: 'id', description: 'ID lớp học' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách học sinh đang active trong lớp.',
  })
  @ApiResponse({
    status: 403,
    description: 'Lớp không thuộc tenant của giáo viên này.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lớp học.' })
  findStudents(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    this.assertTenant(user);
    return this.classesService.findStudents(id, user.tenantId!);
  }

  @Roles(Role.TEACHER)
  @Patch(':id')
  @ApiOperation({
    summary: 'Sửa tên/công khai lớp học',
    description: 'Chỉ TEACHER sở hữu lớp (cùng tenant).',
  })
  @ApiParam({ name: 'id', description: 'ID lớp học' })
  @ApiResponse({ status: 200, description: 'Đã cập nhật lớp học.' })
  @ApiResponse({
    status: 403,
    description: 'Lớp không thuộc tenant của giáo viên này.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lớp học.' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    this.assertTenant(user);
    return this.classesService.update(id, user.tenantId!, dto);
  }

  @Roles(Role.TEACHER)
  @Delete(':id')
  @ApiOperation({
    summary: 'Xoá lớp học',
    description: 'Chỉ TEACHER sở hữu lớp (cùng tenant).',
  })
  @ApiParam({ name: 'id', description: 'ID lớp học' })
  @ApiResponse({ status: 200, description: 'Đã xoá lớp học.' })
  @ApiResponse({
    status: 403,
    description: 'Lớp không thuộc tenant của giáo viên này.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lớp học.' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    this.assertTenant(user);
    return this.classesService.remove(id, user.tenantId!);
  }

  @Roles(Role.TEACHER)
  @Delete(':id/students/:studentId')
  @ApiOperation({
    summary: 'Xoá học sinh khỏi lớp',
    description: 'Chỉ TEACHER sở hữu lớp (cùng tenant).',
  })
  @ApiParam({ name: 'id', description: 'ID lớp học' })
  @ApiParam({ name: 'studentId', description: 'ID học sinh' })
  @ApiResponse({ status: 200, description: 'Đã xoá học sinh khỏi lớp.' })
  @ApiResponse({
    status: 403,
    description: 'Lớp không thuộc tenant của giáo viên này.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy lớp hoặc học sinh không thuộc lớp.',
  })
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
  @ApiOperation({
    summary: 'Tham gia lớp bằng mã mời',
    description: 'Chỉ STUDENT.',
  })
  @ApiResponse({ status: 201, description: 'Đã tham gia lớp.' })
  @ApiResponse({ status: 404, description: 'Mã lớp không hợp lệ.' })
  @ApiResponse({ status: 409, description: 'Học sinh đã ở trong lớp này.' })
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinClassDto) {
    return this.classesService.joinByInviteCode(user.sub, dto.inviteCode);
  }

  @Roles(Role.STUDENT)
  @Get('mine')
  @ApiOperation({
    summary: 'Danh sách lớp học sinh đang tham gia',
    description: 'Chỉ STUDENT.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lớp đang tham gia (trạng thái ACTIVE).',
  })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.classesService.findMyClasses(user.sub);
  }

  @Roles(Role.STUDENT)
  @Get('public')
  @ApiOperation({
    summary: 'Duyệt danh sách lớp công khai',
    description: 'Chỉ STUDENT. Chỉ trả về lớp có isPublic=true.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách lớp công khai.' })
  findPublic() {
    return this.classesService.findPublicClasses();
  }

  @Roles(Role.STUDENT)
  @Post(':id/join-public')
  @ApiOperation({
    summary: 'Tham gia lớp công khai không cần mã mời',
    description: 'Chỉ STUDENT. Chỉ áp dụng cho lớp có isPublic=true.',
  })
  @ApiParam({ name: 'id', description: 'ID lớp học công khai' })
  @ApiResponse({ status: 201, description: 'Đã tham gia lớp.' })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy lớp công khai này.',
  })
  @ApiResponse({ status: 409, description: 'Học sinh đã ở trong lớp này.' })
  joinPublic(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.classesService.joinPublicClass(user.sub, id);
  }

  private assertTenant(user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tài khoản giáo viên chưa có tenant');
    }
  }
}
