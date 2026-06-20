import { Global, Module } from '@nestjs/common';
import { CredentialEncryptionService } from './credential-encryption.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CredentialMigrationService } from './credential-migration.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [CredentialEncryptionService, CredentialMigrationService],
  exports: [CredentialEncryptionService],
})
export class SecurityModule {}
