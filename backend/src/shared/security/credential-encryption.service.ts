import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const PREFIX = 'enc:v1:';

@Injectable()
export class CredentialEncryptionService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string | null | undefined): string | null {
    if (!value) return value ?? null;
    if (value.startsWith(PREFIX)) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64url')}:${tag.toString(
      'base64url',
    )}:${encrypted.toString('base64url')}`;
  }

  decrypt(value: string | null | undefined): string {
    if (!value) return '';
    if (!value.startsWith(PREFIX)) return value;

    const [, , ivValue, tagValue, encryptedValue] = value.split(':');
    if (!ivValue || !tagValue || !encryptedValue) {
      throw new Error('Encrypted credential has an invalid format');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  isConfigured(value: string | null | undefined): boolean {
    return Boolean(value && value !== 'demo');
  }

  private key(): Buffer {
    const configured = this.config.get<string>('CREDENTIAL_ENCRYPTION_KEY');
    if (configured) {
      if (/^[a-f0-9]{64}$/i.test(configured)) {
        return Buffer.from(configured, 'hex');
      }
      const decoded = Buffer.from(configured, 'base64');
      if (decoded.length === 32) return decoded;
    }

    if (this.config.get('NODE_ENV') === 'production') {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key',
      );
    }
    return createHash('sha256')
      .update(
        this.config.get<string>(
          'JWT_SECRET',
          'athleteos-development-credential-key',
        ),
      )
      .digest();
  }
}
