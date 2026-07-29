import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

// @Global() để các processor BullMQ ở module khác (GradingModule,
// QuestionsModule, RoadmapModule) inject MetricsService ghi nhận job AI mà
// không cần import lại MetricsModule ở từng nơi.
@Global()
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
