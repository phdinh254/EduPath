import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_DAILY_BUDGET = 300;
const DEFAULT_TIMEOUT_MS = 20_000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Bọc gọi Google Gemini API thật. Nếu GEMINI_API_KEY chưa được cấu hình,
// isConfigured() trả false — nơi gọi tự quyết định fallback rule-based/mẫu
// có sẵn thay vì để cả hệ thống phụ thuộc cứng vào một API bên ngoài.
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly modelName: string;
  private readonly dailyBudget: number;
  private readonly timeoutMs: number;

  // Đếm số lượt gọi Gemini thật trong ngày (in-memory, đủ dùng cho quy mô
  // hiện tại — single instance, không cần Redis). Reset tự nhiên khi qua
  // ngày mới nhờ so sánh dateKey thay vì phải có cron riêng.
  private callCountToday = 0;
  private dateKey = todayKey();

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.modelName =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-flash-latest';
    this.dailyBudget =
      Number(this.config.get<string>('GEMINI_DAILY_BUDGET')) ||
      DEFAULT_DAILY_BUDGET;
    this.timeoutMs =
      Number(this.config.get<string>('GEMINI_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  // Dùng để ghi vết model thực sự chấm/sinh nội dung (vd. Answer.gradingModel).
  getModelName(): string {
    return this.modelName;
  }

  private requireClient(): GoogleGenerativeAI {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY chưa được cấu hình trên máy chủ');
    }
    return this.client;
  }

  // Chặn chi phí AI vượt tầm kiểm soát (bug lặp vô hạn, lạm dụng endpoint sinh
  // nội dung...) — vượt ngân sách/ngày thì ném lỗi để nơi gọi rơi về fallback
  // rule-based sẵn có, KHÔNG chặn cứng request của học sinh/admin.
  private consumeBudgetOrThrow(): void {
    const currentDateKey = todayKey();
    if (currentDateKey !== this.dateKey) {
      this.dateKey = currentDateKey;
      this.callCountToday = 0;
    }
    if (this.callCountToday >= this.dailyBudget) {
      throw new Error(
        `Đã vượt ngân sách gọi Gemini trong ngày (${this.dailyBudget} lượt)`,
      );
    }
    this.callCountToday += 1;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new Error(`Gemini không phản hồi sau ${this.timeoutMs}ms`)),
        this.timeoutMs,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  // Text tự do — dùng cho lời khuyên/giải thích không cần cấu trúc cố định.
  async generateText(prompt: string): Promise<string> {
    this.consumeBudgetOrThrow();
    const model = this.requireClient().getGenerativeModel({
      model: this.modelName,
    });
    const result = await this.withTimeout(model.generateContent(prompt));
    return result.response.text().trim();
  }

  // Ép Gemini trả JSON đúng cấu trúc; ném lỗi nếu response không parse được
  // JSON để nơi gọi tự quyết định fallback thay vì âm thầm trả dữ liệu hỏng.
  async generateJson<T>(prompt: string): Promise<T> {
    this.consumeBudgetOrThrow();
    const model = this.requireClient().getGenerativeModel({
      model: this.modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await this.withTimeout(model.generateContent(prompt));
    const text = result.response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.warn(`Gemini trả JSON không hợp lệ: ${text.slice(0, 500)}`);
      throw new Error(
        'Gemini trả về dữ liệu không đúng định dạng JSON mong đợi',
      );
    }
  }
}
