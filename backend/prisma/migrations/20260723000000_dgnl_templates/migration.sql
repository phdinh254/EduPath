-- Mẫu đề ĐGNL dùng chung: khai báo 1 lần (danh sách section: môn + số câu +
-- thang điểm, tổng 150), tái dùng nhiều lần khi AI ghép đề ĐGNL thay vì phải
-- gõ lại section thủ công mỗi lần.

CREATE TABLE "DgnlTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DgnlTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DgnlTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "DgnlTemplateSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DgnlTemplateSection_templateId_idx" ON "DgnlTemplateSection"("templateId");

ALTER TABLE "DgnlTemplateSection"
  ADD CONSTRAINT "DgnlTemplateSection_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DgnlTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DgnlTemplateSection"
  ADD CONSTRAINT "DgnlTemplateSection_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
