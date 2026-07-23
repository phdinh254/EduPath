import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { DgnlTemplatesService } from './dgnl-templates.service';
import { CreateDgnlTemplateDto } from './dto/dgnl-template.dto';

@ApiTags('dgnl-templates')
@ApiBearerAuth()
@Controller('dgnl-templates')
export class DgnlTemplatesController {
  constructor(private readonly service: DgnlTemplatesService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách mẫu đề ĐGNL dùng chung',
    description: 'Mọi vai trò đã đăng nhập.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách mẫu đề ĐGNL.' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một mẫu đề ĐGNL',
    description: 'Mọi vai trò đã đăng nhập.',
  })
  @ApiParam({ name: 'id', description: 'ID mẫu đề ĐGNL' })
  @ApiResponse({ status: 200, description: 'Thông tin mẫu đề ĐGNL.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy mẫu đề ĐGNL.' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Tạo mẫu đề ĐGNL dùng chung',
    description:
      'Chỉ ADMIN. Tổng thang điểm các section phải bằng 150 — dùng để AI ghép đề ĐGNL nhanh mà không cần gõ lại section mỗi lần.',
  })
  @ApiResponse({ status: 201, description: 'Đã tạo mẫu đề ĐGNL.' })
  @ApiResponse({
    status: 400,
    description: 'Tổng thang điểm các section không bằng 150.',
  })
  create(@Body() dto: CreateDgnlTemplateDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Xoá mẫu đề ĐGNL',
    description:
      'Chỉ ADMIN. Không ảnh hưởng các đề đã ghép từ mẫu này trước đó.',
  })
  @ApiParam({ name: 'id', description: 'ID mẫu đề ĐGNL' })
  @ApiResponse({ status: 200, description: 'Đã xoá mẫu đề ĐGNL.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
