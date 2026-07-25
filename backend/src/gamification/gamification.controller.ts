import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GamificationService } from './gamification.service';

@ApiTags('gamification')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('me/streak')
  @ApiOperation({
    summary: 'Chuỗi ngày ôn tập liên tiếp của chính mình',
    description:
      'Chỉ STUDENT. Tính tại chỗ từ ExamAttempt.submittedAt — không lưu bảng riêng.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chuỗi hiện tại và chuỗi dài nhất từng đạt.',
  })
  getStreak(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getStreak(user.sub);
  }

  @Get('me/badges')
  @ApiOperation({
    summary: 'Huy hiệu của chính mình',
    description:
      'Chỉ STUDENT. Danh sách toàn bộ huy hiệu kèm trạng thái đã đạt/chưa đạt, tính tại chỗ từ số liệu tích luỹ.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách huy hiệu.' })
  getBadges(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getBadges(user.sub);
  }
}
