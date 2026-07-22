import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Thống kê toàn hệ thống',
    description: 'Chỉ ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Số lượng học sinh, môn học, đề thi, lượt làm bài và câu hỏi theo trạng thái.',
  })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Nhật ký hoạt động hệ thống',
    description: 'Chỉ ADMIN. Phân trang bằng skip/take.',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    type: Number,
    description: 'Mặc định 0',
  })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Mặc định 50',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách audit log, mới nhất trước.',
  })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  findAuditLogs(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.adminService.findAuditLogs(
      skip ? Number(skip) : undefined,
      take ? Number(take) : undefined,
    );
  }
}
