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
      'Chỉ STUDENT. Truyền subjectId để xem 1 môn, bỏ trống để xem toàn bộ môn đã từng làm bài kèm điểm tổng hợp. Tính tại chỗ từ điểm số, độ phủ chuyên đề, mức độ thành thạo, tính đều đặn ôn tập — không lưu bảng riêng.',
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
}
