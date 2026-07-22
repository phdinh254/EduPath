import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradingController } from './grading.controller';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [RoadmapModule, AiModule],
  providers: [GradingService],
  controllers: [GradingController],
  exports: [GradingService],
})
export class GradingModule {}
