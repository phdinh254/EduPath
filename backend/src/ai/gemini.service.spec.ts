import { GeminiService } from './gemini.service';

const generateContentMock = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: generateContentMock }),
  })),
}));

function makeConfig(values: Record<string, string>) {
  return { get: (key: string) => values[key] } as never;
}

describe('GeminiService — ngân sách gọi AI/ngày', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    generateContentMock.mockResolvedValue({
      response: { text: () => '{"score":1}' },
    });
  });

  it('cho phép gọi trong ngân sách, chặn ngay khi vượt ngưỡng — không gọi Gemini thật lần vượt quá', async () => {
    const service = new GeminiService(
      makeConfig({ GEMINI_API_KEY: 'test-key', GEMINI_DAILY_BUDGET: '2' }),
    );

    await service.generateJson('prompt 1');
    await service.generateJson('prompt 2');
    await expect(service.generateJson('prompt 3')).rejects.toThrow(/ngân sách/);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('mỗi service instance đếm ngân sách độc lập theo dailyBudget cấu hình', async () => {
    const strict = new GeminiService(
      makeConfig({ GEMINI_API_KEY: 'test-key', GEMINI_DAILY_BUDGET: '1' }),
    );
    await strict.generateJson('prompt');
    await expect(strict.generateJson('prompt 2')).rejects.toThrow(/ngân sách/);
  });
});

describe('GeminiService — timeout', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  it('huỷ và báo lỗi rõ ràng nếu Gemini không phản hồi trong thời gian cho phép', async () => {
    generateContentMock.mockImplementation(
      () =>
        new Promise(() => {
          /* không bao giờ resolve — mô phỏng Gemini treo */
        }),
    );
    const service = new GeminiService(
      makeConfig({ GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: '10' }),
    );

    await expect(service.generateText('prompt')).rejects.toThrow(
      /không phản hồi/,
    );
  });
});
