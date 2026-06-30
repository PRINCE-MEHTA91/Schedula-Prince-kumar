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
import { NotificationModule } from './notification/notification.module';
import { DoctorProfile } from './doctor/entities/doctor-profile.entity';
import { PatientProfile } from './patient/entities/patient-profile.entity';
import { Appointment } from './appointment/entities/appointment.entity';
import { RecurringAvailability } from './doctor/entities/recurring-availability.entity';
import { CustomAvailability } from './doctor/entities/custom-availability.entity';

import { Notification } from './notification/entities/notification.entity';
import { StreamSlot } from './appointment/entities/stream-slot.entity';
import { WaveSchedule } from './appointment/entities/wave-schedule.entity';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Root application module.
 * Registers all feature modules: Auth, Doctor, Patient, Appointment.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    // PostgreSQL connection
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      entities: [
        User,
        DoctorProfile,
        PatientProfile,
        Appointment,
        RecurringAvailability,
        CustomAvailability,
        Notification, // notifications table
        Notification,
        StreamSlot,
        WaveSchedule,
      ],
      synchronize: true, // Auto-sync DB schema in dev
      migrations: ['dist/migrations/*{.ts,.js}'],
      logging: false,
    }),

    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    AppointmentModule,
    NotificationModule,
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
