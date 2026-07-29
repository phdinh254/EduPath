-- AlterEnum
ALTER TYPE "AttemptStatus" ADD VALUE 'PENDING_REVIEW' BEFORE 'GRADED';

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "needsManualGrading" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fallbackReason" TEXT,
ADD COLUMN     "gradingModel" TEXT,
ADD COLUMN     "gradingPromptVersion" TEXT,
ADD COLUMN     "gradedAt" TIMESTAMP(3);
