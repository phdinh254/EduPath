import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Bọc gọi Google Gemini API thật. Nếu GEMINI_API_KEY chưa được cấu hình,
// isConfigured() trả false — nơi gọi tự quyết định fallback rule-based/mẫu
// có sẵn thay vì để cả hệ thống phụ thuộc cứng vào một API bên ngoài.
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.modelName =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): GoogleGenerativeAI {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY chưa được cấu hình trên máy chủ');
    }
    return this.client;
  }

  // Text tự do — dùng cho lời khuyên/giải thích không cần cấu trúc cố định.
  async generateText(prompt: string): Promise<string> {
    const model = this.requireClient().getGenerativeModel({
      model: this.modelName,
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  // Ép Gemini trả JSON đúng cấu trúc; ném lỗi nếu response không parse được
  // JSON để nơi gọi tự quyết định fallback thay vì âm thầm trả dữ liệu hỏng.
  async generateJson<T>(prompt: string): Promise<T> {
    const model = this.requireClient().getGenerativeModel({
      model: this.modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
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
