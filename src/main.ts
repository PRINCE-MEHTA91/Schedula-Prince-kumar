import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n🚀 Application is running on: http://localhost:${port}\n`);
}
bootstrap();
// Trigger restart
