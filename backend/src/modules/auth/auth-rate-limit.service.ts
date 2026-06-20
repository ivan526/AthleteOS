import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class AuthRateLimitService {
  private readonly attempts = new Map<string, number[]>();

  assertAllowed(key: string): void {
    const now = Date.now();
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp < 15 * 60 * 1000,
    );
    if (recent.length >= 10) {
      throw new HttpException(
        '尝试次数过多，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.attempts.set(key, recent);
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}
