import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global ValidationPipe — validates all incoming request bodies
  // against their DTOs automatically across every route
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Strip unknown properties from body
      forbidNonWhitelisted: true, // Throw error if unknown properties are sent
      transform: true,          // Auto-transform payloads to DTO class instances
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n🚀 Schedula API is running on: http://localhost:${port}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST http://localhost:${port}/auth/signup`);
  console.log(`   POST http://localhost:${port}/auth/login`);
  console.log(`   GET  http://localhost:${port}/doctor/profile  [DOCTOR only]`);
  console.log(`   GET  http://localhost:${port}/patient/profile [PATIENT only]\n`);
}
bootstrap();

