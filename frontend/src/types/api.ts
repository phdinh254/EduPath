export type Role = 'STUDENT' | 'ADMIN';

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
export type DifficultyLevel = 'KNOWLEDGE' | 'COMPREHENSION' | 'APPLICATION' | 'HIGH_APPLICATION';
export type ContentStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
export type ExamCategory = 'THPT' | 'DGNL';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  createdAt: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  parentTopicId: string | null;
  createdAt: string;
}

export interface ExamStructureItem {
  id: string;
  structureId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  questionCount: number;
  maxScorePerQuestion: number;
  order: number;
}

export interface ExamStructure {
  id: string;
  subjectId: string;
  durationMinutes: number;
  items: ExamStructureItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DgnlTemplateSection {
  id: string;
  templateId: string;
  name: string;
  subjectId: string;
  questionCount: number;
  maxScore: number;
  order: number;
}

export interface DgnlTemplate {
  id: string;
  name: string;
  sections: DgnlTemplateSection[];
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  subjectId: string;
  topicId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  content: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  createdById: string;
  status: ContentStatus;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  title: string;
  category: ExamCategory;
  subjectId: string | null;
  createdById: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
  sections?: ExamSection[];
  // Số liệu khám phá đề — chỉ GET /exams trả về, POST /exams và
  // /exams/generate thì không (đề vừa tạo chưa có lượt làm/lượt thích).
  attemptCount?: number;
  likeCount?: number;
  liked?: boolean;
  avgScore?: number | null;
}

export interface ExamSection {
  id: string;
  examId: string;
  name: string;
  order: number;
  maxScore: number;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  sectionId: string | null;
  order: number;
  maxScore: number;
  question: Partial<Question> & { id: string; type: QuestionType; content: string };
}

export interface Answer {
  id: string;
  attemptId: string;
  questionId: string;
  response: unknown;
  timeSpentSeconds: number;
  isCorrect: boolean | null;
  scoreAwarded: number | null;
  aiPreliminaryScore: number | null;
  aiComment: string | null;
  isAiReferenceOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Score {
  id: string;
  attemptId: string;
  totalScore: number;
  topicBreakdown: Record<
    string,
    {
      correct: number;
      total: number;
      subjectId: string;
      timeSpentSeconds: number;
      byType: Record<string, { correct: number; total: number }>;
    }
  >;
  gradedAt: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number | null;
  createdAt: string;
  updatedAt: string;
  answers?: Answer[];
  exam?: Exam;
  score?: Score | null;
  student?: { id: string; fullName: string; email: string };
}

export interface AttemptReviewItem {
  questionId: string;
  sectionId: string | null;
  answerId: string | null;
  content: string;
  type: QuestionType;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  maxScore: number;
  response: unknown;
  isCorrect: boolean | null;
  scoreAwarded: number | null;
  aiPreliminaryScore: number | null;
  aiComment: string | null;
  isAiReferenceOnly: boolean;
  aiExplanation: string | null;
}

export interface WeaknessAnalysis {
  id: string;
  studentId: string;
  subjectId: string;
  attemptId: string | null;
  weakTopics: { topicId: string; correct: number; total: number; persistentCount: number }[];
  // adviceByTopic được AI sinh nền sau khi chấm — có thể chưa xuất hiện ngay.
  details: { adviceByTopic?: Record<string, string> } | null;
  generatedAt: string;
}

export interface StudyRoadmapStage {
  topicId: string;
  stage: 'REVIEW_THEORY' | 'BASIC_PRACTICE' | 'ADVANCED_PRACTICE' | 'RETEST';
  status: string;
}

export interface StudyRoadmap {
  id: string;
  studentId: string;
  subjectId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  stages: StudyRoadmapStage[];
  generatedAt: string;
  updatedAt: string;
}

export interface PendingReviewAnswer extends Answer {
  question: { id: string; content: string };
  attempt: ExamAttempt & { student: { id: string; fullName: string; email: string }; exam: { id: string; title: string } };
}

export interface AdminStats {
  totalStudents: number;
  totalSubjects: number;
  totalExams: number;
  totalAttempts: number;
  questionsByStatus: { pendingApproval: number; approved: number; rejected: number };
}

export interface AuditLog {
  id: string;
  userId: string | null;
  user: { id: string; fullName: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface ApiErrorBody {
  message: string | string[];
  error?: string;
  statusCode: number;
}

export interface StudentNotification {
  id: string;
  type: 'NEW_ADVICE' | 'REMINDER';
  message: string;
  createdAt: string;
  subjectId?: string;
}
