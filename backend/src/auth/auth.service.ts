import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface JwtPayloadShape {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
  exp: number;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }
    if (dto.role === Role.TEACHER && !dto.tenantName) {
      throw new BadRequestException(
        'Giáo viên/trung tâm cần cung cấp tenantName khi đăng ký',
      );
    }
    const passwordHash = (await argon2.hash(dto.password)) as string;
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
    });

    let tenantId: string | undefined;
    if (dto.role === Role.TEACHER) {
      const tenant = await this.prisma.tenant.create({
        data: { name: dto.tenantName!, ownerId: user.id },
      });
      tenantId = tenant.id;
    }

    return this.buildTokens(user.id, user.email, user.role, tenantId);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.buildTokens(
      user.id,
      user.email,
      user.role,
      user.ownedTenant?.id,
    );
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayloadShape;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayloadShape>(
        refreshToken,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revokedAt: null },
    });
    if (!stored || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    // Xoay vòng: thu hồi refresh token cũ ngay khi dùng để tránh tái sử dụng (replay).
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.usersService.findByIdWithTenant(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }

    return this.buildTokens(
      user.id,
      user.email,
      user.role,
      user.ownedTenant?.id,
    );
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private async buildTokens(
    sub: string,
    email: string,
    role: string,
    tenantId?: string,
  ) {
    const payload = { sub, email, role, tenantId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      } as JwtSignOptions),
      // jti đảm bảo mỗi refresh token là duy nhất ngay cả khi cấp trong cùng một giây
      // với cùng payload (JWT ký HMAC là deterministic nên nếu không có jti, hai token
      // cấp liên tiếp có thể trùng hệt nhau, làm hỏng cơ chế thu hồi khi xoay vòng).
      this.jwtService.signAsync({ ...payload, jti: randomUUID() }, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      } as JwtSignOptions),
    ]);

    const decoded = this.jwtService.decode<JwtPayloadShape>(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: sub,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
