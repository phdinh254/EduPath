import * as Joi from 'joi';

// Validate khi khởi động (ConfigModule.forRoot) — server dừng ngay với thông
// báo rõ ràng nếu thiếu biến bắt buộc, thay vì chạy lên rồi lỗi mơ hồ ở lần
// request đầu tiên chạm tới biến đó (vd. getOrThrow('JWT_ACCESS_SECRET') giữa
// một request đăng nhập thật).
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  // Số hop reverse proxy đứng trước backend mà ta TIN để đọc IP client thật
  // từ X-Forwarded-For (xem main.ts) — mặc định 1 khớp kiến trúc hiện tại
  // (chỉ Nginx đứng trước, xem devops/docker-compose.prod.yml). Sai số này
  // theo hướng thấp là an toàn hơn (rate limit vẫn áp đúng theo IP Nginx thay
  // vì bị spoof), nhưng phải tăng lên nếu thêm một reverse proxy/LB nữa phía
  // trước Nginx (ví dụ Caddy làm TLS termination — xem devops/Caddyfile).
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(1),

  DATABASE_URL: Joi.string().uri().required(),

  // Redis cho hàng đợi BullMQ (chấm tự luận, sinh câu hỏi, lời khuyên AI) —
  // xem AiQueueModule/GradingModule/QuestionsModule/RoadmapModule.
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Google OAuth và Gemini là tuỳ chọn — để trống thì các guard/service liên
  // quan tự trả lỗi rõ ràng hoặc rơi về fallback, không cần bắt buộc ở đây.
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().optional(),
  FRONTEND_URL: Joi.string().uri().optional(),

  GEMINI_API_KEY: Joi.string().allow('').optional(),
  GEMINI_MODEL: Joi.string().optional(),
  // Chặn chi phí AI vượt tầm kiểm soát — xem GeminiService.
  GEMINI_DAILY_BUDGET: Joi.number().integer().min(1).optional(),
  GEMINI_TIMEOUT_MS: Joi.number().integer().min(1000).optional(),
})
  // .env còn nhiều biến khác (docker-compose, CI...) không liên quan tới
  // validate ở đây — không chặn những biến lạ.
  .unknown(true);
