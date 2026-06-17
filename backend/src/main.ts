import { NestFactory } from '@nestjs/core';
import { networkInterfaces } from 'os';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
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
