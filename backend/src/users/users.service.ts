import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { ownedTenant: true },
    });
  }

  findByIdWithTenant(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        ownedTenant: { select: { id: true } },
      },
    });
  }

  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: Role;
  }) {
    return this.prisma.user.create({ data });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        ownedTenant: { select: { id: true, name: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        ownedTenant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, fullName: true, isActive: true },
    });
  }

  // Ẩn danh dữ liệu cá nhân theo NĐ13/2023 (bảo vệ dữ liệu trẻ em): xoá
  // email/họ tên/ngày sinh thật, vô hiệu hoá tài khoản và mật khẩu, thu hồi mọi
  // refresh token. Giữ lại id để không phá vỡ khoá ngoại của bài làm/điểm/lớp
  // học đã có (những dữ liệu đó không còn gắn với danh tính thật của học sinh).
  async anonymize(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const passwordHash = (await argon2.hash(randomUUID())) as string;
    return this.prisma.user.update({
      where: { id },
      data: {
        email: `deleted-${id}@deleted.local`,
        fullName: 'Người dùng đã xoá',
        dateOfBirth: null,
        passwordHash,
        isActive: false,
      },
      select: { id: true, email: true, fullName: true, isActive: true },
    });
  }
}
