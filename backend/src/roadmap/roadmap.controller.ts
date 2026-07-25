import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
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
import { RoadmapService } from './roadmap.service';
import { CompleteStageDto } from './dto/complete-stage.dto';

@ApiTags('roadmap')
@ApiBearerAuth()
@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Roles(Role.STUDENT)
  @Get('me/weaknesses')
  @ApiOperation({
    summary: 'Phân tích điểm yếu của chính mình',
    description:
      'Chỉ STUDENT, chỉ xem dữ liệu của bản thân. Tự động tạo sau mỗi lượt làm bài được chấm xong hoàn toàn (rule-based: chuyên đề có tỷ lệ đúng < 50%).',
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    description: 'Lọc theo môn học',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách phân tích điểm yếu theo thời gian.',
  })
  findMyWeaknesses(
    @CurrentUser() user: JwtPayload,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.roadmapService.findWeaknessesForStudent(user.sub, subjectId);
  }

  @Roles(Role.STUDENT)
  @Get('me/study-roadmap')
  @ApiOperation({
    summary: 'Lộ trình ôn tập của chính mình',
    description:
      'Chỉ STUDENT, chỉ xem dữ liệu của bản thân. Lộ trình rule-based 4 giai đoạn (ôn lý thuyết, làm cơ bản, luyện vận dụng, kiểm tra lại) cho mỗi chuyên đề yếu.',
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    description: 'Lọc theo môn học',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lộ trình đang hoạt động.',
  })
  findMyRoadmap(
    @CurrentUser() user: JwtPayload,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.roadmapService.findRoadmapForStudent(user.sub, subjectId);
  }

  @Roles(Role.STUDENT)
  @Patch('me/stages')
  @ApiOperation({
    summary: 'Đánh dấu một giai đoạn ôn tập đã hoàn thành',
    description:
      'Chỉ STUDENT, chỉ trên lộ trình của chính mình. Phải hoàn thành đúng thứ tự (không nhảy cóc). Tự đóng lộ trình (COMPLETED) khi mọi giai đoạn đã xong.',
  })
  @ApiResponse({ status: 200, description: 'Lộ trình sau khi cập nhật.' })
  @ApiResponse({
    status: 400,
    description:
      'Giai đoạn không hợp lệ hoặc chưa hoàn thành giai đoạn trước đó.',
  })
  completeStage(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CompleteStageDto,
  ) {
    return this.roadmapService.completeStage(
      user.sub,
      dto.roadmapId,
      dto.topicId,
      dto.stage,
    );
  }
}
