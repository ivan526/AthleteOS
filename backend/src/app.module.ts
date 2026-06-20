import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestController } from './test.controller';
import { PrismaModule } from './shared/prisma/prisma.module';
import { SyncModule } from './modules/sync/sync.module';
import { AthleteModule } from './modules/athlete/athlete.module';
import { TrainingModule } from './modules/training/training.module';
import { AuthModule } from './modules/auth/auth.module';
import { SecurityModule } from './shared/security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    SecurityModule,
    SyncModule,
    AthleteModule,
    TrainingModule,
  ],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule {}
