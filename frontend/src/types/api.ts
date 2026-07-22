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
  topicBreakdown: Record<string, { correct: number; total: number; subjectId: string }>;
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
}

export interface WeaknessAnalysis {
  id: string;
  studentId: string;
  subjectId: string;
  attemptId: string | null;
  weakTopics: { topicId: string; correct: number; total: number }[];
  details: unknown;
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
