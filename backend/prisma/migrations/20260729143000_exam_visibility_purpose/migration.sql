-- CreateEnum
CREATE TYPE "ExamVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ExamPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExamPurpose" AS ENUM ('OFFICIAL', 'PERSONAL_PRACTICE');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "visibility" "ExamVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "status" "ExamPublishStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "purpose" "ExamPurpose" NOT NULL DEFAULT 'OFFICIAL';

-- CreateIndex
CREATE INDEX "Exam_visibility_status_idx" ON "Exam"("visibility", "status");
