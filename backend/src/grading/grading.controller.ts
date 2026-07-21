import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
import { GradingService } from './grading.service';
import { ReviewEssayDto } from './dto/review-essay.dto';

@ApiTags('grading')
@ApiBearerAuth()
@Controller('grading')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Roles(Role.STUDENT)
  @Post('attempts/:attemptId/submit')
  @ApiOperation({
    summary: 'Nộp bài và chấm điểm tự động',
    description:
      'Chỉ STUDENT chủ bài làm. Chấm trắc nghiệm/đúng-sai/trả lời ngắn ngay lập tức. Câu tự luận: chấm sơ bộ bằng AI (rule-based) - nếu đề không gắn lớp thì công bố điểm ngay kèm nhãn tham khảo, nếu có gắn lớp thì chờ giáo viên duyệt. Roadmap AI được tạo tự động khi lượt làm bài được chấm xong hoàn toàn.',
  })
  @ApiParam({ name: 'attemptId', description: 'ID lượt làm bài' })
  @ApiResponse({
    status: 201,
    description:
      'Lượt làm bài đã chấm (GRADED) hoặc đang chờ duyệt Văn (SUBMITTED).',
  })
  @ApiResponse({
    status: 400,
    description: 'Lượt làm bài đã được nộp trước đó.',
  })
  @ApiResponse({
    status: 403,
    description: 'Đây không phải lượt làm bài của bạn.',
  })
  submit(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId') attemptId: string,
  ) {
    return this.gradingService.submitAttempt(attemptId, user);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get('pending-review')
  @ApiOperation({
    summary: 'Danh sách bài tự luận đang chờ duyệt điểm',
    description:
      'TEACHER: giới hạn trong tenant của mình. ADMIN: toàn hệ thống.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách câu trả lời tự luận chờ duyệt kèm điểm AI sơ bộ.',
  })
  findPendingReview(@CurrentUser() user: JwtPayload) {
    return this.gradingService.findPendingReview(user);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post('answers/:answerId/review')
  @ApiOperation({
    summary: 'Duyệt/điều chỉnh điểm bài tự luận',
    description:
      'TEACHER/ADMIN cùng tenant với đề thi. Công bố điểm chính thức, ghi vào TeacherReview.',
  })
  @ApiParam({ name: 'answerId', description: 'ID câu trả lời tự luận' })
  @ApiResponse({
    status: 201,
    description:
      'Đã công bố điểm chính thức, lượt làm bài chuyển sang GRADED nếu không còn câu nào chờ duyệt.',
  })
  @ApiResponse({
    status: 400,
    description: 'Câu trả lời không phải dạng tự luận.',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền duyệt bài này.' })
  review(
    @CurrentUser() user: JwtPayload,
    @Param('answerId') answerId: string,
    @Body() dto: ReviewEssayDto,
  ) {
    return this.gradingService.reviewEssay(
      answerId,
      user,
      dto.finalScore,
      dto.comment,
    );
  }
}
