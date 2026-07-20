import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradingController } from './grading.controller';

@Module({
  providers: [GradingService],
  controllers: [GradingController],
  exports: [GradingService],
})
export class GradingModule {}
