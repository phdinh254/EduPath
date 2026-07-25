-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('IMPORTED_REAL', 'ADMIN_MANUAL', 'AI_GENERATED');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "source" "QuestionSource" NOT NULL DEFAULT 'ADMIN_MANUAL';
