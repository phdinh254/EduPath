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
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      } as JwtSignOptions),
    ]);
    return { accessToken, refreshToken };
  }
}
