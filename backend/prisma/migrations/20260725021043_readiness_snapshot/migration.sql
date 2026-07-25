-- CreateTable
CREATE TABLE "ReadinessSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "readinessScore" INTEGER NOT NULL,
    "dateKey" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadinessSnapshot_studentId_subjectId_idx" ON "ReadinessSnapshot"("studentId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessSnapshot_studentId_subjectId_dateKey_key" ON "ReadinessSnapshot"("studentId", "subjectId", "dateKey");

-- AddForeignKey
ALTER TABLE "ReadinessSnapshot" ADD CONSTRAINT "ReadinessSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
