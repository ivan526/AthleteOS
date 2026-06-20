import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialEncryptionService } from './credential-encryption.service';

@Injectable()
export class CredentialMigrationService implements OnModuleInit {
  private readonly logger = new Logger(CredentialMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialEncryptionService,
  ) {}

  async onModuleInit(): Promise<void> {
    const [accounts, llmSettings] = await Promise.all([
      this.prisma.connectedAccount.findMany({
        where: { apiKey: { not: '' } },
        select: { id: true, apiKey: true },
      }),
      this.prisma.llmSetting.findMany({
        where: { apiKey: { not: null } },
        select: { id: true, apiKey: true },
      }),
    ]);

    let migrated = 0;
    for (const account of accounts) {
      const encrypted = this.credentials.encrypt(account.apiKey);
      if (encrypted !== account.apiKey) {
        await this.prisma.connectedAccount.update({
          where: { id: account.id },
          data: { apiKey: encrypted! },
        });
        migrated++;
      }
    }
    for (const setting of llmSettings) {
      const encrypted = this.credentials.encrypt(setting.apiKey);
      if (encrypted !== setting.apiKey) {
        await this.prisma.llmSetting.update({
          where: { id: setting.id },
          data: { apiKey: encrypted },
        });
        migrated++;
      }
    }
    if (migrated > 0) {
      this.logger.log(`Encrypted ${migrated} existing credential records`);
    }
  }
}
