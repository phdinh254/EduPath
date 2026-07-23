import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { DgnlTemplatesService } from './dgnl-templates.service';
import { DgnlTemplatesController } from './dgnl-templates.controller';
import { QuestionsModule } from '../questions/questions.module';
import { GradingModule } from '../grading/grading.module';

@Module({
  imports: [QuestionsModule, GradingModule],
  providers: [ExamsService, DgnlTemplatesService],
  controllers: [ExamsController, DgnlTemplatesController],
  exports: [ExamsService],
})
export class ExamsModule {}
