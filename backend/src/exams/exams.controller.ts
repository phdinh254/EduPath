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
import { SaveAnswerDto } from './dto/save-answer.dto';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Tạo đề thi mới',
    description:
      'TEACHER (thuộc tenant của họ, có thể gán classId) hoặc ADMIN (đề chính thức/dùng chung, tenantId=null).',
  })
  @ApiResponse({ status: 201, description: 'Đã tạo đề thi.' })
  @ApiResponse({ status: 403, description: 'Giáo viên chưa có tenant.' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamDto) {
    return this.examsService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách đề thi',
    description:
      'ADMIN: tất cả. TEACHER: đề thuộc tenant của mình. STUDENT: đề chính thức/dùng chung + đề của các lớp mình đang tham gia.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách đề thi theo phạm vi phù hợp với vai trò.',
  })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.examsService.findAllForUser(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một đề thi',
    description: 'Theo phạm vi truy cập tương ứng vai trò/tenant/lớp.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 200, description: 'Thông tin đề thi.' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập đề thi này.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi.' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.findOne(id, user);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(':id/questions')
  @ApiOperation({
    summary: 'Thêm câu hỏi vào đề thi',
    description:
      'TEACHER/ADMIN sở hữu đề. Câu hỏi phải thuộc tenant của người tạo hoặc đã ở kho dùng chung.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 201, description: 'Đã thêm câu hỏi vào đề.' })
  @ApiResponse({
    status: 403,
    description:
      'Không có quyền quản lý đề thi này hoặc câu hỏi không được phép dùng.',
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
      'STUDENT: correctAnswer bị ẩn (đang làm bài). TEACHER/ADMIN: đầy đủ đáp án đúng.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 200, description: 'Danh sách câu hỏi trong đề.' })
  listQuestions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.listQuestions(id, user);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get(':id/attempts')
  @ApiOperation({
    summary: 'Danh sách lượt làm bài của một đề',
    description:
      'TEACHER/ADMIN sở hữu đề - dùng để theo dõi tiến độ/kết quả học sinh.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({ status: 200, description: 'Danh sách lượt làm bài kèm điểm.' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền quản lý đề thi này.',
  })
  listAttempts(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.listAttemptsForExam(id, user);
  }

  @Roles(Role.STUDENT)
  @Post(':id/attempts')
  @ApiOperation({
    summary: 'Bắt đầu một lượt làm bài',
    description:
      'Chỉ STUDENT. Đề gắn lớp: học sinh phải thuộc lớp đó. Đề chính thức (tenantId=null): mọi học sinh đều làm được. Idempotent: nếu đã có lượt IN_PROGRESS thì trả về lượt đó.',
  })
  @ApiParam({ name: 'id', description: 'ID đề thi' })
  @ApiResponse({
    status: 201,
    description: 'Lượt làm bài (mới tạo hoặc đang dở dang).',
  })
  @ApiResponse({
    status: 403,
    description: 'Học sinh không thuộc lớp được giao đề thi này.',
  })
  startAttempt(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.startAttempt(id, user);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({
    summary: 'Chi tiết một lượt làm bài',
    description:
      'Học sinh chủ bài làm, hoặc giáo viên/admin cùng tenant với đề.',
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
      'Chỉ khả dụng khi lượt làm bài đã ở trạng thái SUBMITTED hoặc GRADED (không xem được khi đang làm bài). Học sinh chủ bài làm, hoặc giáo viên/admin cùng tenant với đề.',
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
