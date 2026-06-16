import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { User } from './auth/user.entity';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { AppointmentModule } from './appointment/appointment.module';
import { DoctorProfile } from './doctor/entities/doctor-profile.entity';
import { PatientProfile } from './patient/entities/patient-profile.entity';
import { DoctorSchedule } from './appointment/entities/doctor-schedule.entity';
import { AppointmentSlot } from './appointment/entities/appointment-slot.entity';
import { WaveBooking } from './appointment/entities/wave-booking.entity';

/**
 * Root application module.
 * Registers all feature modules: Auth, Doctor, Patient.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // PostgreSQL connection
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      entities: [User, DoctorProfile, PatientProfile, DoctorSchedule, AppointmentSlot, WaveBooking],
      synchronize: false, // Use migrations instead of auto-sync
      migrations: ['dist/migrations/*{.ts,.js}'],
      logging: false,
    }),

    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    AppointmentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Guards — protect all routes by default
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
