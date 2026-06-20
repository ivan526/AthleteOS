import { NestFactory } from '@nestjs/core';
import { networkInterfaces } from 'os';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? allowedOrigins
        : (origin, callback) => {
            if (
              !origin ||
              /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(
                origin,
              )
            ) {
              callback(null, true);
            } else {
              callback(new Error('Origin is not allowed by CORS'));
            }
          },
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3007);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`Backend running on http://localhost:${port}`);
  for (const address of getLanAddresses()) {
    console.log(`Backend LAN URL: http://${address}:${port}`);
  }
}

function getLanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

bootstrap();
