import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StudentClassStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

function generateInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async createForTeacher(teacherId: string, dto: CreateClassDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { ownerId: teacherId },
    });
    if (!tenant) {
      throw new NotFoundException('Giáo viên chưa có tenant');
    }
    return this.prisma.class.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        inviteCode: generateInviteCode(),
      },
    });
  }

  findAllForTenant(tenantId: string) {
    return this.prisma.class.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertTeacherOwnsClass(classId: string, tenantId: string) {
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
    });
    if (!klass) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }
    if (klass.tenantId !== tenantId) {
      throw new ForbiddenException('Bạn không có quyền truy cập lớp học này');
    }
    return klass;
  }

  async findStudents(classId: string, tenantId: string) {
    await this.assertTeacherOwnsClass(classId, tenantId);
    return this.prisma.studentClass.findMany({
      where: { classId, status: StudentClassStatus.ACTIVE },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async joinByInviteCode(studentId: string, inviteCode: string) {
    const klass = await this.prisma.class.findUnique({ where: { inviteCode } });
    if (!klass) {
      throw new NotFoundException('Mã lớp không hợp lệ');
    }
    const existing = await this.prisma.studentClass.findUnique({
      where: { studentId_classId: { studentId, classId: klass.id } },
    });
    if (existing && existing.status === StudentClassStatus.ACTIVE) {
      throw new ConflictException('Học sinh đã ở trong lớp này');
    }
    if (existing) {
      return this.prisma.studentClass.update({
        where: { id: existing.id },
        data: {
          status: StudentClassStatus.ACTIVE,
          removedAt: null,
          joinedAt: new Date(),
        },
      });
    }
    return this.prisma.studentClass.create({
      data: { studentId, classId: klass.id },
    });
  }

  async removeStudent(classId: string, studentId: string, tenantId: string) {
    await this.assertTeacherOwnsClass(classId, tenantId);
    const link = await this.prisma.studentClass.findUnique({
      where: { studentId_classId: { studentId, classId } },
    });
    if (!link || link.status !== StudentClassStatus.ACTIVE) {
      throw new NotFoundException('Học sinh không thuộc lớp này');
    }
    return this.prisma.studentClass.update({
      where: { id: link.id },
      data: { status: StudentClassStatus.REMOVED, removedAt: new Date() },
    });
  }

  findMyClasses(studentId: string) {
    return this.prisma.studentClass.findMany({
      where: { studentId, status: StudentClassStatus.ACTIVE },
      include: { class: true },
    });
  }

  async findOne(classId: string, tenantId: string) {
    return this.assertTeacherOwnsClass(classId, tenantId);
  }

  async update(classId: string, tenantId: string, dto: UpdateClassDto) {
    await this.assertTeacherOwnsClass(classId, tenantId);
    return this.prisma.class.update({
      where: { id: classId },
      data: { name: dto.name },
    });
  }

  async remove(classId: string, tenantId: string) {
    await this.assertTeacherOwnsClass(classId, tenantId);
    await this.prisma.class.delete({ where: { id: classId } });
    return { id: classId, deleted: true };
  }
}
