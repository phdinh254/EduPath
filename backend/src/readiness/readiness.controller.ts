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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ReadinessService } from './readiness.service';

@ApiTags('readiness')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('readiness')
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Điểm sẵn sàng thi của chính mình',
    description:
      'Chỉ STUDENT. Truyền subjectId để xem 1 môn, bỏ trống để xem toàn bộ môn đã từng làm bài kèm điểm tổng hợp. Tính tại chỗ từ điểm số, độ phủ chuyên đề, mức độ thành thạo, tính đều đặn ôn tập.',
  })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Điểm sẵn sàng thi kèm dự đoán khoảng điểm.',
  })
  getMyReadiness(
    @CurrentUser() user: JwtPayload,
    @Query('subjectId') subjectId?: string,
  ) {
    if (subjectId) {
      return this.readinessService.getReadinessForSubject(user.sub, subjectId);
    }
    return this.readinessService.getMyReadiness(user.sub);
  }

  @Get('me/history')
  @ApiOperation({
    summary: 'Lịch sử điểm sẵn sàng thi theo ngày',
    description:
      'Chỉ STUDENT. Bắt buộc subjectId. Trả về các mốc điểm sẵn sàng đã chụp lại (mỗi ngày 1 điểm) để vẽ xu hướng — chụp tự động sau mỗi lượt làm bài được chấm.',
  })
  @ApiQuery({ name: 'subjectId', required: true })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: 200,
    description: 'Danh sách điểm sẵn sàng theo ngày.',
  })
  getReadinessHistory(
    @CurrentUser() user: JwtPayload,
    @Query('subjectId') subjectId: string,
    @Query('days') days?: string,
  ) {
    return this.readinessService.getReadinessHistory(
      user.sub,
      subjectId,
      days ? Number(days) : undefined,
    );
  }
}
