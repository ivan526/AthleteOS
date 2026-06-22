import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CredentialEncryptionService } from '../../shared/security/credential-encryption.service';
import { AuthGuard } from './auth.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('Authentication security primitives', () => {
  const config = new ConfigService({
    JWT_SECRET: 'test-secret-with-at-least-thirty-two-characters',
    CREDENTIAL_ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  });

  it('hashes passwords with a unique salt and verifies them', async () => {
    const service = new PasswordService();
    const first = await service.hash('SecurePass2026');
    const second = await service.hash('SecurePass2026');

    expect(first).not.toBe(second);
    expect(await service.verify('SecurePass2026', first)).toBe(true);
    expect(await service.verify('wrong-password', first)).toBe(false);
  });

  it('encrypts credentials without storing plaintext', () => {
    const service = new CredentialEncryptionService(config);
    const encrypted = service.encrypt('provider-secret')!;

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('provider-secret');
    expect(service.decrypt(encrypted)).toBe('provider-secret');
  });

  it('rejects an invalid credential key during production startup', () => {
    const service = new CredentialEncryptionService(
      new ConfigService({
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret-with-at-least-thirty-two-characters',
        CREDENTIAL_ENCRYPTION_KEY: '0123456789abcdef'.repeat(3) + '0123456789abcde',
      }),
    );

    expect(() => service.onModuleInit()).toThrow(
      'CREDENTIAL_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key',
    );
  });

  it('attaches only the validated session user to a protected request', async () => {
    const tokenService = new TokenService(config);
    const authService = {
      validateSession: jest.fn().mockResolvedValue(true),
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new AuthGuard(reflector, tokenService, authService as any);
    const request: any = {
      headers: {
        authorization: `Bearer ${tokenService.signAccessToken(
          'user-a',
          'session-a',
        )}`,
      },
    };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe('user-a');
    expect(authService.validateSession).toHaveBeenCalledWith(
      'user-a',
      'session-a',
    );
  });
});
