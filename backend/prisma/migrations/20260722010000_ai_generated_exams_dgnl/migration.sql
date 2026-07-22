-- CreateEnum
CREATE TYPE "ExamCategory" AS ENUM ('THPT', 'DGNL');

-- AlterTable: Exam.subjectId becomes optional, add category
ALTER TABLE "Exam" ALTER COLUMN "subjectId" DROP NOT NULL;
ALTER TABLE "Exam" ADD COLUMN "category" "ExamCategory" NOT NULL DEFAULT 'THPT';

-- CreateTable
CREATE TABLE "ExamSection" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ExamSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamSection_examId_idx" ON "ExamSection"("examId");

ALTER TABLE "ExamSection" ADD CONSTRAINT "ExamSection_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: ExamQuestion.sectionId
ALTER TABLE "ExamQuestion" ADD COLUMN "sectionId" TEXT;

CREATE INDEX "ExamQuestion_sectionId_idx" ON "ExamQuestion"("sectionId");

ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "ExamSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
