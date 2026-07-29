export const GRADE_ESSAY_QUEUE = 'grade-essay';

export interface GradeEssayJobData {
  attemptId: string;
  questionId: string;
  questionContent: string;
  maxScore: number;
}
