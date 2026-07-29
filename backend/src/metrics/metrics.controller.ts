import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

// Endpoint Prometheus scrape — công khai (Prometheus không gửi JWT) nhưng
// không được lộ ra ngoài qua Nginx (chỉ /api/ được reverse-proxy công khai,
// xem frontend/nginx.conf) — chỉ truy cập được trong mạng nội bộ Docker.
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): Promise<string> {
    return this.metrics.getMetricsText();
  }
}
