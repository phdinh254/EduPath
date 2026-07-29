import type { WeakTopic } from './roadmap.service';

export const GENERATE_ADVICE_QUEUE = 'generate-advice';

export interface GenerateAdviceJobData {
  weaknessAnalysisId: string;
  weakTopics: WeakTopic[];
}
