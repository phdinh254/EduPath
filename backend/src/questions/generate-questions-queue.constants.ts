import type { DifficultyLevel, QuestionType } from '@prisma/client';

export const GENERATE_QUESTIONS_QUEUE = 'generate-questions';

export interface GenerateQuestionsJobData {
  subjectId: string;
  topicId: string;
  topicName: string;
  subjectName: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  count: number;
  creatorId: string;
  startIndex: number;
}
