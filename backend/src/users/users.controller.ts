import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Hồ sơ của người dùng hiện tại',
    description:
      'Bất kỳ vai trò nào đã đăng nhập. Trả về thông tin cá nhân kèm tenant sở hữu (nếu là giáo viên).',
  })
  @ApiResponse({ status: 200, description: 'Hồ sơ người dùng.' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ.',
  })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({
    summary: 'Danh sách người dùng',
    description: 'Chỉ ADMIN. Lọc theo vai trò nếu có.',
  })
  @ApiQuery({ name: 'role', enum: Role, required: false })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Mặc định 1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Mặc định 20, tối đa 100',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách người dùng có phân trang.',
  })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  findAll(
    @Query('role', new ParseEnumPipe(Role, { optional: true }))
    role: Role | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.usersService.findAll(role, pagination.page, pagination.limit);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Kích hoạt / vô hiệu hoá tài khoản',
    description: 'Chỉ ADMIN.',
  })
  @ApiParam({ name: 'id', description: 'ID người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Đã cập nhật trạng thái tài khoản.',
  })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng.' })
  setActive(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.setActive(id, dto.isActive);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Ẩn danh dữ liệu cá nhân của người dùng',
    description:
      'Chỉ ADMIN. Xoá email/họ tên/ngày sinh thật, vô hiệu hoá tài khoản, thu hồi refresh token — phục vụ yêu cầu xoá dữ liệu cá nhân theo NĐ13/2023. Không xoá cứng để giữ toàn vẹn dữ liệu học tập/điểm số liên quan.',
  })
  @ApiParam({ name: 'id', description: 'ID người dùng' })
  @ApiResponse({ status: 200, description: 'Đã ẩn danh tài khoản.' })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng.' })
  anonymize(@Param('id') id: string) {
    return this.usersService.anonymize(id);
  }
}
