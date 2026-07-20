import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContentStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { RejectQuestionDto } from './dto/reject-question.dto';

@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionDto) {
    return this.questionsService.create(user, dto);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('status') status?: ContentStatus) {
    return this.questionsService.findAll(user, status);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.questionsService.findOne(id, user);
  }

  @Roles(Role.TEACHER)
  @Post(':id/propose')
  propose(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.questionsService.proposeForGlobal(id, user);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.questionsService.approve(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  reject(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RejectQuestionDto) {
    return this.questionsService.reject(id, user.sub, dto.reason);
  }
}
