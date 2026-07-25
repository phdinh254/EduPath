import { IsIn, IsString } from 'class-validator';
import { ROADMAP_STAGES, type RoadmapStage } from '../roadmap.service';

export class CompleteStageDto {
  @IsString()
  roadmapId: string;

  @IsString()
  topicId: string;

  @IsIn(ROADMAP_STAGES)
  stage: RoadmapStage;
}
