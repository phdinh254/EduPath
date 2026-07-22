-- Học sinh "thích" đề thi — dùng để hiển thị lượt thích khi khám phá đề thi.

CREATE TABLE "ExamLike" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamLike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamLike_examId_idx" ON "ExamLike"("examId");

CREATE UNIQUE INDEX "ExamLike_examId_studentId_key" ON "ExamLike"("examId", "studentId");

ALTER TABLE "ExamLike"
  ADD CONSTRAINT "ExamLike_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamLike"
  ADD CONSTRAINT "ExamLike_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
