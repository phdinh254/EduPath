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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

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
    description: 'Chỉ ADMIN. Phân trang bằng page/limit.',
  })
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
    description: 'Danh sách audit log có phân trang, mới nhất trước.',
  })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  findAuditLogs(@Query() pagination: PaginationQueryDto) {
    return this.adminService.findAuditLogs(pagination.page, pagination.limit);
  }
}
