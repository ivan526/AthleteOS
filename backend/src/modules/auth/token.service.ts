import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access';
  iat: number;
  exp: number;
}

@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService) {}

  signAccessToken(userId: string, sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Number(this.config.get('ACCESS_TOKEN_TTL_SECONDS', 900));
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'access',
      iat: now,
      exp: now + ttl,
    };
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const body = this.encode(payload);
    return `${header}.${body}.${this.signature(`${header}.${body}`)}`;
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) throw new UnauthorizedException('登录状态无效');
    const expected = this.signature(`${header}.${body}`);
    if (signature !== expected) throw new UnauthorizedException('登录状态无效');

    try {
      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as AccessTokenPayload;
      if (
        payload.type !== 'access' ||
        !payload.sub ||
        !payload.sid ||
        payload.exp <= Math.floor(Date.now() / 1000)
      ) {
        throw new Error('expired');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('登录已过期');
    }
  }

  createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private encode(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private signature(value: string): string {
    return createHmac('sha256', this.getSecret()).update(value).digest('base64url');
  }

  private getSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new Error('JWT_SECRET must contain at least 32 characters');
      }
      return 'athleteos-development-secret-change-me';
    }
    return secret;
  }
}
