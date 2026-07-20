import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('tenants')
  findTenants() {
    return this.adminService.findTenants();
  }

  @Get('audit-logs')
  findAuditLogs(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.adminService.findAuditLogs(skip ? Number(skip) : undefined, take ? Number(take) : undefined);
  }
}
