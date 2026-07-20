import { IsOptional, IsString } from 'class-validator';

export class SaveAnswerDto {
  @IsString()
  questionId: string;

  // Cấu trúc tuỳ theo loại câu hỏi (index lựa chọn, mảng đúng/sai, chuỗi trả lời ngắn, bài viết tự luận...)
  @IsOptional()
  response?: unknown;
}
