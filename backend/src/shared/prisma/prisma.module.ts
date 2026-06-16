import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CurrentUserService } from './current-user.service';

@Module({
  providers: [PrismaService, CurrentUserService],
  exports: [PrismaService, CurrentUserService],
})
export class PrismaModule {}
