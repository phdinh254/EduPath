-- Cấu trúc đề cố định theo môn (THPT): số câu theo dạng x mức độ khó, dùng
-- làm khuôn khi AI ghép đề cho môn đó thay vì admin tự gõ số lượng mỗi lần.

CREATE TABLE "ExamStructure" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamStructure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamStructure_subjectId_key" ON "ExamStructure"("subjectId");

ALTER TABLE "ExamStructure"
  ADD CONSTRAINT "ExamStructure_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExamStructureItem" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "difficulty" "DifficultyLevel" NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "maxScorePerQuestion" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ExamStructureItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamStructureItem_structureId_idx" ON "ExamStructureItem"("structureId");

ALTER TABLE "ExamStructureItem"
  ADD CONSTRAINT "ExamStructureItem_structureId_fkey"
  FOREIGN KEY ("structureId") REFERENCES "ExamStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
