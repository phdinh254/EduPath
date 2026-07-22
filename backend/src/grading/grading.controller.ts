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
      'Chỉ STUDENT chủ bài làm. Chấm trắc nghiệm/đúng-sai/trả lời ngắn và tự luận (AI, rule-based) ngay lập tức, công bố điểm ngay không chờ giáo viên duyệt trước (kể cả bài thuộc lớp). Điểm tự luận luôn gắn nhãn "điểm tham khảo do AI đánh giá"; giáo viên có thể điều chỉnh lại sau qua /grading/answers/:id/review. Roadmap AI được tạo tự động ngay sau khi chấm xong.',
  })
  @ApiParam({ name: 'attemptId', description: 'ID lượt làm bài' })
  @ApiResponse({
    status: 201,
    description: 'Lượt làm bài đã chấm xong (GRADED).',
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
    summary: 'Danh sách bài tự luận AI đã chấm, chưa được giáo viên hậu kiểm',
    description:
      'Điểm đã công bố cho học sinh — đây là danh sách để giáo viên/admin spot-check chất lượng AI, không chặn học sinh xem điểm. TEACHER: giới hạn lớp thuộc tenant của mình. ADMIN: toàn hệ thống.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách câu trả lời tự luận kèm điểm AI đã công bố.',
  })
  findPendingReview(@CurrentUser() user: JwtPayload) {
    return this.gradingService.findPendingReview(user);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post('answers/:answerId/review')
  @ApiOperation({
    summary: 'Điều chỉnh lại điểm bài tự luận (hậu kiểm)',
    description:
      'TEACHER (lớp thuộc tenant mình) / ADMIN. Ghi đè điểm AI đã công bố, lưu vào TeacherReview — không còn là bước duyệt chặn công bố ban đầu.',
  })
  @ApiParam({ name: 'answerId', description: 'ID câu trả lời tự luận' })
  @ApiResponse({
    status: 201,
    description: 'Đã cập nhật điểm chính thức.',
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
