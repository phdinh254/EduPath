import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ContentStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { RejectQuestionDto } from './dto/reject-question.dto';

@ApiTags('questions')
@ApiBearerAuth()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Tạo câu hỏi mới',
    description:
      'TEACHER hoặc ADMIN. Câu hỏi của TEACHER thuộc tenant của họ ở trạng thái DRAFT. Câu hỏi của ADMIN tự động vào kho dùng chung (APPROVED, isGlobal=true).',
  })
  @ApiResponse({ status: 201, description: 'Đã tạo câu hỏi.' })
  @ApiResponse({ status: 403, description: 'Giáo viên chưa có tenant.' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionDto) {
    return this.questionsService.create(user, dto);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get()
  @ApiOperation({
    summary: 'Danh sách câu hỏi',
    description:
      'TEACHER thấy câu hỏi thuộc tenant của mình + câu hỏi đã duyệt trong kho dùng chung. ADMIN thấy tất cả, có thể lọc theo trạng thái.',
  })
  @ApiQuery({ name: 'status', enum: ContentStatus, required: false })
  @ApiResponse({ status: 200, description: 'Danh sách câu hỏi.' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ContentStatus,
  ) {
    return this.questionsService.findAll(user, status);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một câu hỏi',
    description:
      'TEACHER/ADMIN. Chỉ xem được câu hỏi thuộc tenant mình hoặc đã ở kho dùng chung.',
  })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết câu hỏi, bao gồm correctAnswer.',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền xem câu hỏi này.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy câu hỏi.' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.questionsService.findOne(id, user);
  }

  @Roles(Role.TEACHER)
  @Post(':id/propose')
  @ApiOperation({
    summary: 'Đề xuất câu hỏi vào kho dùng chung',
    description:
      'Chỉ TEACHER, chỉ với câu hỏi của chính mình đang ở trạng thái DRAFT. Chuyển sang PENDING_APPROVAL chờ ADMIN duyệt.',
  })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiResponse({
    status: 201,
    description: 'Đã chuyển câu hỏi sang trạng thái chờ duyệt.',
  })
  @ApiResponse({
    status: 400,
    description: 'Câu hỏi không ở trạng thái DRAFT.',
  })
  @ApiResponse({ status: 403, description: 'Không phải chủ sở hữu câu hỏi.' })
  propose(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.questionsService.proposeForGlobal(id, user);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  @ApiOperation({
    summary: 'Duyệt câu hỏi vào kho dùng chung',
    description: 'Chỉ ADMIN. Câu hỏi phải đang ở trạng thái PENDING_APPROVAL.',
  })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiResponse({
    status: 201,
    description: 'Đã duyệt: status=APPROVED, isGlobal=true.',
  })
  @ApiResponse({
    status: 400,
    description: 'Câu hỏi chưa được đề xuất phê duyệt.',
  })
  approve(@Param('id') id: string) {
    return this.questionsService.approve(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  @ApiOperation({
    summary: 'Từ chối câu hỏi được đề xuất',
    description:
      'Chỉ ADMIN. Lý do từ chối (nếu có) được ghi vào AuditLog và lưu vào Question.rejectReason để giáo viên đề xuất tự tra cứu qua GET /questions/:id.',
  })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiResponse({ status: 201, description: 'Đã từ chối: status=REJECTED.' })
  @ApiResponse({
    status: 400,
    description: 'Câu hỏi chưa được đề xuất phê duyệt.',
  })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectQuestionDto,
  ) {
    return this.questionsService.reject(id, user.sub, dto.reason);
  }
}
