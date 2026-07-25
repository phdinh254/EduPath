import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SaveAnswerDto {
  @IsString()
  questionId: string;

  // Cấu trúc tuỳ theo loại câu hỏi (index lựa chọn, mảng đúng/sai, chuỗi trả lời ngắn, bài viết tự luận...)
  @IsOptional()
  response?: unknown;

  // Số giây học sinh vừa dừng ở câu này (chênh lệch từ lần lưu trước, không
  // phải tổng dồn) — backend cộng dồn vào timeSpentSeconds hiện có.
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSeconds?: number;
}
