-- B2C thuần: bỏ hẳn giáo viên/lớp học/trung tâm — học sinh tự chọn đề thi,
-- không qua lớp. ADMIN quản lý toàn bộ nội dung hệ thống.

-- Drop join/dependent tables that only existed for the class/teacher model.
ALTER TABLE "StudentClass" DROP CONSTRAINT IF EXISTS "StudentClass_studentId_fkey";
ALTER TABLE "StudentClass" DROP CONSTRAINT IF EXISTS "StudentClass_classId_fkey";
DROP TABLE "StudentClass";

ALTER TABLE "TeacherReview" DROP CONSTRAINT IF EXISTS "TeacherReview_answerId_fkey";
ALTER TABLE "TeacherReview" DROP CONSTRAINT IF EXISTS "TeacherReview_teacherId_fkey";
DROP TABLE "TeacherReview";

-- Remove class/tenant scoping from Exam (every exam is now open to all students).
ALTER TABLE "Exam" DROP CONSTRAINT IF EXISTS "Exam_tenantId_fkey";
ALTER TABLE "Exam" DROP CONSTRAINT IF EXISTS "Exam_classId_fkey";
DROP INDEX IF EXISTS "Exam_tenantId_idx";
ALTER TABLE "Exam" DROP COLUMN "tenantId";
ALTER TABLE "Exam" DROP COLUMN "classId";

-- Remove tenant scoping + isGlobal from Question (single shared question bank).
ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_tenantId_fkey";
DROP INDEX IF EXISTS "Question_tenantId_idx";
ALTER TABLE "Question" DROP COLUMN "tenantId";
ALTER TABLE "Question" DROP COLUMN "isGlobal";

-- Drop Class then Tenant (Class depended on Tenant).
ALTER TABLE "Class" DROP CONSTRAINT IF EXISTS "Class_tenantId_fkey";
DROP TABLE "Class";
DROP TABLE "Tenant";
DROP TYPE IF EXISTS "StudentClassStatus";

-- Clean up rows that no longer fit the shrunk enums before altering them:
-- DRAFT questions were private teacher drafts (unreachable in the new flow);
-- TEACHER users no longer have a role in this system.
DELETE FROM "Question" WHERE "status" = 'DRAFT';
DELETE FROM "User" WHERE "role" = 'TEACHER';

-- Shrink ContentStatus: drop DRAFT.
CREATE TYPE "ContentStatus_new" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');
ALTER TABLE "Question" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Question" ALTER COLUMN "status" TYPE "ContentStatus_new" USING ("status"::text::"ContentStatus_new");
ALTER TABLE "Question" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';
DROP TYPE "ContentStatus";
ALTER TYPE "ContentStatus_new" RENAME TO "ContentStatus";

-- Shrink Role: drop TEACHER.
CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Recreate TeacherReview as ScoreOverride (ADMIN post-hoc override of AI essay scores).
CREATE TABLE "ScoreOverride" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "originalAiScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScoreOverride_answerId_key" ON "ScoreOverride"("answerId");

ALTER TABLE "ScoreOverride" ADD CONSTRAINT "ScoreOverride_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreOverride" ADD CONSTRAINT "ScoreOverride_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
