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
import { GenerateQuestionsDto } from './dto/generate-questions.dto';

// Giáo viên không còn tự soạn câu hỏi — toàn bộ ngân hàng câu hỏi do ADMIN
// tạo thủ công hoặc do AI tự sinh (xem POST /questions/generate và luồng ghép
// đề tự động ở ExamsService). Các endpoint dưới đây chỉ dành cho ADMIN quản
// lý/kiểm duyệt nội dung.
@ApiTags('questions')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo câu hỏi thủ công',
    description:
      'Chỉ ADMIN. Câu hỏi vào thẳng kho dùng chung (APPROVED, isGlobal=true).',
  })
  @ApiResponse({ status: 201, description: 'Đã tạo câu hỏi.' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionDto) {
    return this.questionsService.create(user, dto);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'AI sinh một lô câu hỏi mới',
    description:
      'Chỉ ADMIN. AI tự sinh nội dung mới (không sao chép nguyên văn đề thi/tài liệu bản quyền), đưa vào trạng thái PENDING_APPROVAL chờ ADMIN duyệt trước khi vào kho dùng chung.',
  })
  @ApiResponse({
    status: 201,
    description: 'Đã sinh câu hỏi, trạng thái PENDING_APPROVAL.',
  })
  generate(@CurrentUser() user: JwtPayload, @Body() dto: GenerateQuestionsDto) {
    return this.questionsService.generateBatch(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách câu hỏi',
    description: 'Chỉ ADMIN. Có thể lọc theo trạng thái.',
  })
  @ApiQuery({ name: 'status', enum: ContentStatus, required: false })
  @ApiResponse({ status: 200, description: 'Danh sách câu hỏi.' })
  findAll(@Query('status') status?: ContentStatus) {
    return this.questionsService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một câu hỏi',
    description: 'Chỉ ADMIN.',
  })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết câu hỏi, bao gồm correctAnswer.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy câu hỏi.' })
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Duyệt câu hỏi AI sinh vào kho dùng chung',
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

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Từ chối / rút câu hỏi khỏi kho dùng chung',
    description:
      'Chỉ ADMIN. Áp dụng cho câu hỏi PENDING_APPROVAL hoặc APPROVED (kể cả câu AI sinh bù tự động công bố khi ghép đề) — dùng để kiểm duyệt nội dung/bản quyền sau khi phát hành. Lý do (nếu có) được ghi vào AuditLog và Question.rejectReason.',
  })
  @ApiParam({ name: 'id', description: 'ID câu hỏi' })
  @ApiResponse({ status: 201, description: 'Đã từ chối: status=REJECTED.' })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectQuestionDto,
  ) {
    return this.questionsService.reject(id, user.sub, dto.reason);
  }
}
