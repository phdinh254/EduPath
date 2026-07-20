import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RoadmapService } from './roadmap.service';

@ApiTags('roadmap')
@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Roles(Role.STUDENT)
  @Get('me/weaknesses')
  findMyWeaknesses(@CurrentUser() user: JwtPayload, @Query('subjectId') subjectId?: string) {
    return this.roadmapService.findWeaknessesForStudent(user.sub, subjectId);
  }

  @Roles(Role.STUDENT)
  @Get('me/study-roadmap')
  findMyRoadmap(@CurrentUser() user: JwtPayload, @Query('subjectId') subjectId?: string) {
    return this.roadmapService.findRoadmapForStudent(user.sub, subjectId);
  }
}
