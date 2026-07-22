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
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Tạo đề thi thủ công',
    description:
      'Chỉ ADMIN. Xem POST /exams/generate cho luồng AI ghép đề tự động (mặc định).',
  })
  @ApiResponse({ status: 201, description: 'Đã tạo đề thi.' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamDto) {
    return this.examsService.create(user, dto);
  }

  @Roles(Role.ADMIN)
  @Post('generate')
  @ApiOperation({
    summary: 'AI tự động ghép đề hoàn chỉnh',
    description:
      'Chỉ ADMIN. category=THPT: 1 môn, trắc nghiệm 3 dạng hoặc tự luận Văn. category=DGNL: nhiều section theo môn, tổng thang điểm 150. Câu hỏi lấy từ kho đã duyệt, AI sinh bù ngay nếu thiếu.',
  })
  @ApiResponse({ status: 201, description: 'Đã sinh đề thi hoàn chỉnh.' })
  generate(@CurrentUser() user: JwtPayload, @Body() dto: GenerateExamDto) {
    return this.examsService.generateExam(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách đề thi',
    description:
      'Mọi vai trò đã đăng nhập. Học sinh tự chọn đề để thi thử/ôn tập — mọi đề đều mở, không còn giới hạn theo lớp học.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách đề thi.',
  })
  findAll() {
    return this.examsService.findAllForUser();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một đề thi',
    description: 'Mọi vai trò đã đăng nhập.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 200, description: 'Thông tin đề thi.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi.' })
  findOne(@Param('id') id: string) {
    return this.examsService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/questions')
  @ApiOperation({
    summary: 'Thêm câu hỏi vào đề thi',
    description: 'Chỉ ADMIN. Câu hỏi phải đã ở kho dùng chung đã duyệt.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 201, description: 'Đã thêm câu hỏi vào đề.' })
  @ApiResponse({
    status: 403,
    description: 'Câu hỏi không được phép dùng.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy đề thi hoặc câu hỏi.',
  })
  addQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddExamQuestionDto,
  ) {
    return this.examsService.addQuestion(id, user, dto);
  }

  @Get(':id/questions')
  @ApiOperation({
    summary: 'Danh sách câu hỏi trong đề',
    description:
      'STUDENT: correctAnswer bị ẩn (đang làm bài). ADMIN: đầy đủ đáp án đúng.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 200, description: 'Danh sách câu hỏi trong đề.' })
  listQuestions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.listQuestions(id, user);
  }

  @Roles(Role.ADMIN)
  @Get(':id/attempts')
  @ApiOperation({
    summary: 'Danh sách lượt làm bài của một đề',
    description: 'Chỉ ADMIN - dùng để theo dõi/thống kê.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 200, description: 'Danh sách lượt làm bài kèm điểm.' })
  listAttempts(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.listAttemptsForExam(id, user);
  }

  @Roles(Role.STUDENT)
  @Post(':id/attempts')
  @ApiOperation({
    summary: 'Bắt đầu một lượt làm bài',
    description:
      'Chỉ STUDENT. Idempotent: nếu đã có lượt IN_PROGRESS thì trả về lượt đó.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({
    status: 201,
    description: 'Lượt làm bài (mới tạo hoặc đang dở dang).',
  })
  startAttempt(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.startAttempt(id, user);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({
    summary: 'Chi tiết một lượt làm bài',
    description: 'Học sinh chủ bài làm, hoặc ADMIN.',
  })
  @ApiParam({ name: 'attemptId', description: 'ID lượt làm bài' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin lượt làm bài kèm câu trả lời và điểm.',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xem lượt làm bài này.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lượt làm bài.' })
  getAttempt(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId') attemptId: string,
  ) {
    return this.examsService.getAttempt(attemptId, user);
  }

  @Get('attempts/:attemptId/review')
  @ApiOperation({
    summary: 'Xem đáp án đúng, giải thích và câu sai sau khi nộp bài',
    description:
      'Chỉ khả dụng khi lượt làm bài đã ở trạng thái SUBMITTED hoặc GRADED (không xem được khi đang làm bài). Học sinh chủ bài làm, hoặc ADMIN.',
  })
  @ApiParam({ name: 'attemptId', description: 'ID lượt làm bài' })
  @ApiResponse({
    status: 200,
    description:
      'Danh sách câu hỏi kèm đáp án đúng, giải thích, câu trả lời và điểm từng câu.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bài làm chưa được nộp, chưa thể xem đáp án.',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xem lượt làm bài này.',
  })
  getAttemptReview(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId') attemptId: string,
  ) {
    return this.examsService.getAttemptReview(attemptId, user);
  }

  @Roles(Role.STUDENT)
  @Post('attempts/:attemptId/answers')
  @ApiOperation({
    summary: 'Lưu câu trả lời cho một câu hỏi',
    description:
      'Chỉ STUDENT chủ bài làm, chỉ khi lượt làm bài đang IN_PROGRESS. Upsert theo (attemptId, questionId).',
  })
  @ApiParam({ name: 'attemptId', description: 'ID lượt làm bài' })
  @ApiResponse({ status: 201, description: 'Đã lưu câu trả lời.' })
  @ApiResponse({ status: 400, description: 'Lượt làm bài đã kết thúc.' })
  @ApiResponse({
    status: 403,
    description: 'Đây không phải lượt làm bài của bạn.',
  })
  saveAnswer(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId') attemptId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.examsService.saveAnswer(
      attemptId,
      user,
      dto.questionId,
      dto.response,
    );
  }
}
