import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Dùng chung cho mọi endpoint danh sách lớn (đề thi, câu hỏi, người dùng,
// audit log...) — giới hạn limit tối đa 100 để tránh một request kéo cả bảng
// về (vd. limit=999999) làm chậm DB/response.
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
