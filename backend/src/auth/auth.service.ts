import { createHash, randomUUID } from 'node:crypto';
import {
  Injectable,
  ConflictException,
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
import type { GoogleProfile } from './strategies/google.strategy';

interface JwtPayloadShape {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Chống dò mật khẩu: sau MAX_FAILED_ATTEMPTS lần sai liên tiếp, khoá đăng
// nhập tạm thời LOCKOUT_DURATION_MS thay vì khoá vĩnh viễn (không cần ADMIN
// can thiệp thủ công cho từng tài khoản).
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // Đăng ký công khai luôn tạo STUDENT — tài khoản ADMIN chỉ tạo trực tiếp
  // trong DB, không bao giờ nhận role từ request để tránh tự leo quyền.
  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const passwordHash = (await argon2.hash(dto.password)) as string;
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: Role.STUDENT,
    });

    return this.buildTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new UnauthorizedException(
        `Tài khoản tạm khoá do đăng nhập sai nhiều lần — thử lại sau khoảng ${minutesLeft} phút`,
      );
    }

    const passwordOk =
      !!user && (await argon2.verify(user.passwordHash, dto.password));
    if (!user || !passwordOk) {
      if (user)
        await this.registerFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    return this.buildTokens(user.id, user.email, user.role);
  }

  private async registerFailedLogin(userId: string, currentAttempts: number) {
    const attempts = currentAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: lockedUntil ? 0 : attempts,
        lockedUntil,
      },
    });
  }

  // Đăng nhập/đăng ký bằng Google: khớp theo email, tự tạo tài khoản STUDENT
  // nếu chưa từng đăng ký (mật khẩu ngẫu nhiên không dùng tới vì tài khoản
  // này chỉ đăng nhập qua Google). Email trùng với tài khoản đăng ký thường
  // sẽ được coi là cùng một người và đăng nhập được luôn qua Google.
  async loginWithGoogle(profile: GoogleProfile) {
    let user = await this.usersService.findByEmail(profile.email);
    if (!user) {
      const passwordHash = (await argon2.hash(randomUUID())) as string;
      user = await this.usersService.create({
        email: profile.email,
        passwordHash,
        fullName: profile.fullName,
        role: Role.STUDENT,
      });
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }
    return this.buildTokens(user.id, user.email, user.role);
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

    // Thu hồi bằng một câu UPDATE nguyên tử có điều kiện (chưa thu hồi + chưa hết hạn)
    // thay vì findFirst rồi update riêng — tránh race khi 2 request refresh đồng thời
    // dùng chung một token đều đọc thấy "hợp lệ" trước khi request kia kịp ghi, dẫn
    // đến token gốc bị "nhân bản" thành hai phiên hợp lệ. count > 0 nghĩa là chính
    // request này đã giành quyền thu hồi token; các request khác trên cùng token sẽ
    // thấy count === 0 do điều kiện revokedAt: null không còn đúng nữa.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: {
        userId: payload.sub,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }

    return this.buildTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private async buildTokens(sub: string, email: string, role: string) {
    const payload = { sub, email, role };
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
