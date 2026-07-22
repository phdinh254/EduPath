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
      'Chỉ STUDENT chủ bài làm. Chấm trắc nghiệm/đúng-sai/trả lời ngắn và tự luận (AI, rule-based) ngay lập tức, công bố điểm ngay. Điểm tự luận luôn gắn nhãn "điểm tham khảo do AI đánh giá"; ADMIN có thể điều chỉnh lại sau qua /grading/answers/:id/review. Roadmap AI được tạo tự động ngay sau khi chấm xong.',
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

  @Roles(Role.ADMIN)
  @Get('pending-review')
  @ApiOperation({
    summary: 'Danh sách bài tự luận AI đã chấm, chưa được ADMIN hậu kiểm',
    description:
      'Chỉ ADMIN. Điểm đã công bố cho học sinh — đây là danh sách để spot-check chất lượng AI, không chặn học sinh xem điểm.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách câu trả lời tự luận kèm điểm AI đã công bố.',
  })
  findPendingReview() {
    return this.gradingService.findPendingReview();
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
