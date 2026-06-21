import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUserService } from '../../shared/prisma/current-user.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly currentUser: CurrentUserService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() body: { email: string; password: string; name?: string; remember_me?: boolean },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const key = `register:${this.clientIp(request)}:${body.email?.toLowerCase()}`;
    this.rateLimit.assertAllowed(key);
    const result = await this.authService.register(body, this.context(request));
    this.rateLimit.clear(key);
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
      body.remember_me !== false,
    );
    return this.authResponse(result, request);
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: { email: string; password: string; remember_me?: boolean },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const key = `login:${this.clientIp(request)}:${body.email?.toLowerCase()}`;
    this.rateLimit.assertAllowed(key);
    const result = await this.authService.login(body, this.context(request));
    this.rateLimit.clear(key);
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
      body.remember_me !== false,
    );
    return this.authResponse(result, request);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: { refresh_token?: string; remember_me?: boolean },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      body.refresh_token ?? this.readCookie(request, 'athleteos_refresh'),
      this.context(request),
    );
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
      body.remember_me !== false,
    );
    return this.authResponse(result, request);
  }

  @Post('logout')
  @Public()
  async logout(
    @Body() body: { refresh_token?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      body.refresh_token ?? this.readCookie(request, 'athleteos_refresh'),
    );
    response.clearCookie('athleteos_refresh', this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  async me() {
    return this.authService.getUser(await this.currentUser.getUserId());
  }

  private setRefreshCookie(
    response: Response,
    token: string,
    expires: Date,
    remember: boolean,
  ): void {
    response.cookie('athleteos_refresh', token, {
      ...this.cookieOptions(),
      ...(remember ? { expires } : {}),
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth',
    };
  }

  private readCookie(request: Request, name: string): string | undefined {
    const cookie = request.headers.cookie;
    if (!cookie) return undefined;
    return cookie
      .split(';')
      .map((value) => value.trim().split('='))
      .find(([key]) => key === name)?.[1];
  }

  private context(request: Request) {
    return {
      ipAddress: this.clientIp(request),
      userAgent: request.headers['user-agent'],
    };
  }

  private clientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    return (
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) ??
      request.ip ??
      'unknown'
    );
  }

  private authResponse(
    result: {
      accessToken: string;
      refreshToken: string;
      user: unknown;
    },
    request: Request,
  ) {
    return {
      access_token: result.accessToken,
      refresh_token:
        request.headers['x-client-type'] === 'mobile'
          ? result.refreshToken
          : undefined,
      user: result.user,
    };
  }
}
