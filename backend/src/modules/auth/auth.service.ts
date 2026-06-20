import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  async register(
    input: { email: string; password: string; name?: string },
    context: ClientContext,
  ) {
    if (!this.registrationAllowed()) {
      throw new ForbiddenException('当前未开放自主注册');
    }
    const email = this.normalizeEmail(input.email);
    this.validatePassword(input.password);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.passwordHash) {
      throw new ConflictException('该邮箱已注册');
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const legacyUserId = this.config.get<string>('LEGACY_USER_ID');
    const legacyEmail = this.config
      .get<string>('LEGACY_USER_EMAIL', '')
      .trim()
      .toLowerCase();
    const canClaimLegacy =
      legacyUserId && legacyEmail === email && !existing?.passwordHash;

    const user = await this.prisma.$transaction(async (prisma) => {
      if (existing) {
        return prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            name: input.name?.trim() || existing.name,
            status: 'active',
          },
        });
      }

      if (canClaimLegacy) {
        const legacy = await prisma.user.findUnique({
          where: { id: legacyUserId },
        });
        if (legacy && !legacy.passwordHash) {
          return prisma.user.update({
            where: { id: legacy.id },
            data: {
              email,
              name: input.name?.trim() || legacy.name,
              passwordHash,
              status: 'active',
            },
          });
        }
      }

      return prisma.user.create({
        data: {
          email,
          name: input.name?.trim() || email.split('@')[0],
          passwordHash,
          athleteProfile: {
            create: {
              primarySport: 'running',
              weeklyAvailableDays: 5,
              preferredSports: ['running', 'cycling'],
            },
          },
        },
      });
    });

    return this.createSession(user.id, context);
  }

  async login(
    input: { email: string; password: string },
    context: ClientContext,
  ) {
    const email = this.normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid =
      user?.passwordHash &&
      (await this.passwordService.verify(input.password, user.passwordHash));
    if (!user || !valid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('账户已停用');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.createSession(user.id, context);
  }

  async refresh(refreshToken: string | undefined, context: ClientContext) {
    if (!refreshToken) throw new UnauthorizedException('刷新令牌缺失');
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'active'
    ) {
      throw new UnauthorizedException('登录会话已失效');
    }

    const nextRefreshToken = this.tokenService.createRefreshToken();
    const expiresAt = this.refreshExpiry();
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        tokenHash: this.hashToken(nextRefreshToken),
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return {
      accessToken: this.tokenService.signAccessToken(
        session.userId,
        session.id,
      ),
      refreshToken: nextRefreshToken,
      refreshExpiresAt: expiresAt,
      user: this.toPublicUser(session.user),
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.userSession.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('用户不存在或已停用');
    }
    return this.toPublicUser(user);
  }

  async validateSession(
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'active' },
      },
      select: { id: true },
    });
    return Boolean(session);
  }

  private async createSession(userId: string, context: ClientContext) {
    const refreshToken = this.tokenService.createRefreshToken();
    const expiresAt = this.refreshExpiry();
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      include: { user: true },
    });

    return {
      accessToken: this.tokenService.signAccessToken(userId, session.id),
      refreshToken,
      refreshExpiresAt: expiresAt,
      user: this.toPublicUser(session.user),
    };
  }

  private refreshExpiry(): Date {
    const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 30));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string): string {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new UnauthorizedException('请输入有效邮箱');
    }
    return normalized;
  }

  private validatePassword(password: string): void {
    if (
      !password ||
      password.length < 10 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new UnauthorizedException('密码至少 10 位，并同时包含字母和数字');
    }
  }

  private registrationAllowed(): boolean {
    return this.config.get<string>('ALLOW_REGISTRATION', 'true') !== 'false';
  }

  private toPublicUser(user: {
    id: string;
    email: string | null;
    name: string | null;
    status: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    };
  }
}
