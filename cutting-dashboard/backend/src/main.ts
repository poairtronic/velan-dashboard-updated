import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;
  app.enableCors(); // Allow React frontend to access
  await app.listen(port);
  Logger.log(`Cutting Dashboard API running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
