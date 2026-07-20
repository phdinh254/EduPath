import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';

@ApiTags('subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  findAll() {
    return this.subjectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subjectsService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(dto);
  }

  @Get(':id/topics')
  findTopics(@Param('id') id: string) {
    return this.subjectsService.findTopics(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/topics')
  createTopic(@Param('id') id: string, @Body() dto: CreateTopicDto) {
    return this.subjectsService.createTopic(id, dto);
  }
}
