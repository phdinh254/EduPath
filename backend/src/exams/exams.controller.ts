import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@ApiTags('exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamDto) {
    return this.examsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.examsService.findAllForUser(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.findOne(id, user);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(':id/questions')
  addQuestion(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddExamQuestionDto) {
    return this.examsService.addQuestion(id, user, dto);
  }

  @Get(':id/questions')
  listQuestions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.listQuestions(id, user);
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get(':id/attempts')
  listAttempts(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.listAttemptsForExam(id, user);
  }

  @Roles(Role.STUDENT)
  @Post(':id/attempts')
  startAttempt(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.examsService.startAttempt(id, user);
  }

  @Get('attempts/:attemptId')
  getAttempt(@CurrentUser() user: JwtPayload, @Param('attemptId') attemptId: string) {
    return this.examsService.getAttempt(attemptId, user);
  }

  @Get('attempts/:attemptId/review')
  getAttemptReview(@CurrentUser() user: JwtPayload, @Param('attemptId') attemptId: string) {
    return this.examsService.getAttemptReview(attemptId, user);
  }

  @Roles(Role.STUDENT)
  @Post('attempts/:attemptId/answers')
  saveAnswer(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId') attemptId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.examsService.saveAnswer(attemptId, user, dto.questionId, dto.response);
  }
}
