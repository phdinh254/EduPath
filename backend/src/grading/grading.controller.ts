import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('attempts/:attemptId/submit')
  @ApiOperation({
    summary: 'Nộp bài và chấm điểm tự động',
    description:
      'Chỉ STUDENT chủ bài làm. Trắc nghiệm/đúng-sai/trả lời ngắn chấm ngay lập tức. Câu tự luận (nếu có nội dung và Gemini đã cấu hình) được xếp vào hàng đợi chấm nền (BullMQ) thay vì chặn response này — attempt trả về ở trạng thái PENDING_REVIEW, tự chuyển GRADED khi job chấm xong (điểm gắn nhãn "điểm tham khảo do AI đánh giá"). ADMIN có thể điều chỉnh lại sau qua /grading/answers/:id/review. Roadmap AI được tạo tự động ngay sau khi chấm xong hoàn toàn.',
  })
  @ApiParam({ name: 'attemptId', description: 'ID lượt làm bài' })
  @ApiResponse({
    status: 201,
    description:
      'Lượt làm bài đã nộp — SUBMITTED/GRADED nếu không có câu tự luận đang chờ, hoặc PENDING_REVIEW nếu còn câu tự luận đang chấm nền/chờ ADMIN.',
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

  @Roles(Role.ADMIN)
  @Get('pending-review')
  @ApiOperation({
    summary: 'Danh sách bài tự luận ADMIN cần xem qua',
    description:
      'Chỉ ADMIN. Gồm 2 loại (phân biệt bằng needsManualGrading): true = KHẨN CẤP, Gemini lỗi lúc nộp bài, chưa hề công bố điểm, đang chặn attempt ở PENDING_REVIEW; false = AI đã chấm và công bố rồi, chỉ là spot-check chất lượng. Danh sách sắp xếp khẩn cấp lên đầu.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách câu trả lời tự luận cần xem qua.',
  })
  findPendingReview() {
    return this.gradingService.findPendingReview();
  }

  @Roles(Role.ADMIN)
  @Get('ai-quality-stats')
  @ApiOperation({
    summary: 'Độ lệch điểm giữa AI và người chấm (chấm tự luận)',
    description:
      'Chỉ ADMIN. Tính từ các lần ADMIN đã hậu kiểm/chấm tay (ScoreOverride) có kèm điểm AI ban đầu — sai số tuyệt đối trung bình, sai số lớn nhất, tỷ lệ trong ngưỡng chấp nhận (0.5 điểm), tách theo model đã dùng chấm.',
  })
  @ApiResponse({
    status: 200,
    description: 'Số liệu độ lệch điểm AI vs người chấm.',
  })
  getAiQualityStats() {
    return this.gradingService.getAiGradingDeviationStats();
  }

  @Roles(Role.ADMIN)
  @Post('answers/:answerId/review')
  @ApiOperation({
    summary: 'Điều chỉnh lại điểm bài tự luận (hậu kiểm)',
    description:
      'Chỉ ADMIN. Ghi đè điểm AI đã công bố, lưu vào ScoreOverride — không chặn công bố ban đầu.',
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

  @Roles(Role.STUDENT, Role.ADMIN)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('answers/:answerId/explain')
  @ApiOperation({
    summary: 'AI giải thích tại sao câu trả lời sai',
    description:
      'Chỉ áp dụng cho câu trắc nghiệm/đúng-sai/trả lời ngắn đã chấm sai (không áp dụng cho tự luận). Học sinh chỉ xem được giải thích cho bài của chính mình. Kết quả được cache lại, chỉ gọi AI thật ở lần yêu cầu đầu tiên.',
  })
  @ApiParam({ name: 'answerId', description: 'ID câu trả lời' })
  @ApiResponse({ status: 201, description: 'Trả về giải thích AI.' })
  @ApiResponse({
    status: 400,
    description: 'Câu trả lời là tự luận hoặc chưa sai.',
  })
  @ApiResponse({
    status: 503,
    description: 'Tính năng giải thích AI chưa được cấu hình trên máy chủ.',
  })
  explain(
    @CurrentUser() user: JwtPayload,
    @Param('answerId') answerId: string,
  ) {
    return this.gradingService.explainWrongAnswer(answerId, user);
  }
}
