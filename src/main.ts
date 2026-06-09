import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // DTO mein jo fields nahi hain woh strip ho jaayengi
      forbidNonWhitelisted: true, // Unknown params aaye toh 400 error do
      transform: true,            // Query strings ko numbers/booleans mein auto-convert karo
      transformOptions: {
        enableImplicitConversion: true, // e.g. "1" → 1, "true" → true
      },
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

