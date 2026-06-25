import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS so frontends can communicate with the API
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip fields not in DTO
      forbidNonWhitelisted: true, // Return 400 for unknown params
      transform: true, // Auto-convert query strings to numbers/booleans
      transformOptions: {
        enableImplicitConversion: true, // e.g. "1" → 1, "true" → true
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const base = `http://localhost:${port}`;
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         🚀  Schedula API is running!                    ║
║         📍  ${base}                    ║
╚══════════════════════════════════════════════════════════╝

🔐  AUTH
   POST  ${base}/auth/signup
   POST  ${base}/auth/login

👨‍⚕️  DOCTOR  (requires DOCTOR role)
   POST  ${base}/doctor/profile          ← create profile
   GET   ${base}/doctor/profile          ← get own profile
   PATCH ${base}/doctor/profile          ← update profile
   POST  ${base}/doctor/availability     ← set recurring schedule
   POST  ${base}/doctor/availability/override  ← custom date override

🗓️  SLOTS  (public — no auth needed)
   GET   ${base}/doctor/:id/slots?date=YYYY-MM-DD

🔍  DISCOVERY  (any authenticated user)
   GET   ${base}/doctor             ← list all doctors
   GET   ${base}/doctor/:id         ← doctor detail

🧑‍💼  PATIENT  (requires PATIENT role)
   POST  ${base}/patient/profile    ← create profile
   GET   ${base}/patient/profile    ← get own profile
   PATCH ${base}/patient/profile    ← update profile

📅  APPOINTMENTS  (requires PATIENT role)
   POST   ${base}/appointments           ← book a slot
   GET    ${base}/appointments/my        ← my appointments
   DELETE ${base}/appointments/:id       ← cancel appointment
`);
}
bootstrap();
