import {
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  userId?: string;
  sessionId?: string;
};

@Injectable({ scope: Scope.REQUEST })
export class CurrentUserService {
  constructor(
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}

  async getUserId(): Promise<string> {
    if (!this.request.userId) {
      throw new UnauthorizedException('请先登录');
    }
    return this.request.userId;
  }

  getSessionId(): string | undefined {
    return this.request.sessionId;
  }
}
