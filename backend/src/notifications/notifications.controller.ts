import { Controller, Get, Post } from '@nestjs/common';
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
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Thông báo/nhắc nhở của chính mình',
    description:
      'Chỉ STUDENT. Tính tại chỗ từ dữ liệu hiện có: lời khuyên AI mới (WeaknessAnalysis) và nhắc nhở nếu lâu chưa ôn tập.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách thông báo và số lượng chưa đọc.',
  })
  getMyNotifications(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getMyNotifications(user);
  }

  @Post('me/read')
  @ApiOperation({
    summary: 'Đánh dấu đã đọc toàn bộ thông báo lời khuyên AI',
    description:
      'Chỉ STUDENT. Không ảnh hưởng đến nhắc nhở lâu chưa ôn tập (tự hết khi có lượt làm bài mới).',
  })
  @ApiResponse({ status: 201, description: 'Đã đánh dấu đã đọc.' })
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user);
  }
}
