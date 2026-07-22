import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpsertExamStructureDto } from './dto/upsert-exam-structure.dto';

@ApiTags('subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách môn học',
    description: 'Mọi vai trò đã đăng nhập.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách môn học.' })
  findAll() {
    return this.subjectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một môn học',
    description: 'Mọi vai trò đã đăng nhập.',
  })
  @ApiParam({ name: 'id', description: 'ID môn học' })
  @ApiResponse({ status: 200, description: 'Thông tin môn học.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học.' })
  findOne(@Param('id') id: string) {
    return this.subjectsService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo môn học mới', description: 'Chỉ ADMIN.' })
  @ApiResponse({ status: 201, description: 'Đã tạo môn học.' })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  create(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(dto);
  }

  @Get(':id/topics')
  @ApiOperation({
    summary: 'Danh sách chuyên đề của một môn học',
    description: 'Mọi vai trò đã đăng nhập.',
  })
  @ApiParam({ name: 'id', description: 'ID môn học' })
  @ApiResponse({ status: 200, description: 'Danh sách chuyên đề.' })
  findTopics(@Param('id') id: string) {
    return this.subjectsService.findTopics(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/topics')
  @ApiOperation({
    summary: 'Tạo chuyên đề mới trong một môn học',
    description: 'Chỉ ADMIN.',
  })
  @ApiParam({ name: 'id', description: 'ID môn học' })
  @ApiResponse({ status: 201, description: 'Đã tạo chuyên đề.' })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học.' })
  createTopic(@Param('id') id: string, @Body() dto: CreateTopicDto) {
    return this.subjectsService.createTopic(id, dto);
  }

  @Get(':id/exam-structure')
  @ApiOperation({
    summary: 'Cấu trúc đề cố định của môn học (THPT)',
    description:
      'Mọi vai trò đã đăng nhập. Trả về null nếu môn chưa được cấu hình cấu trúc đề — khi đó AI ghép đề cho môn này sẽ báo lỗi.',
  })
  @ApiParam({ name: 'id', description: 'ID môn học' })
  @ApiResponse({ status: 200, description: 'Cấu trúc đề hoặc null.' })
  getExamStructure(@Param('id') id: string) {
    return this.subjectsService.getExamStructure(id);
  }

  @Roles(Role.ADMIN)
  @Put(':id/exam-structure')
  @ApiOperation({
    summary: 'Khai báo/cập nhật cấu trúc đề cố định của môn học',
    description:
      'Chỉ ADMIN. Thay thế toàn bộ cấu trúc cũ (nếu có) bằng danh sách item mới (dạng câu × mức độ khó × số câu × điểm/câu). Áp dụng cho mọi lần AI ghép đề sau đó của môn này.',
  })
  @ApiParam({ name: 'id', description: 'ID môn học' })
  @ApiResponse({ status: 201, description: 'Đã lưu cấu trúc đề.' })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học.' })
  upsertExamStructure(
    @Param('id') id: string,
    @Body() dto: UpsertExamStructureDto,
  ) {
    return this.subjectsService.upsertExamStructure(id, dto);
  }
}
