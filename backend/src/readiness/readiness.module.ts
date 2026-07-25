import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ReadinessService } from './readiness.service';
import { ReadinessController } from './readiness.controller';

@Module({
  imports: [AiModule, GamificationModule],
  providers: [ReadinessService],
  controllers: [ReadinessController],
})
export class ReadinessModule {}
