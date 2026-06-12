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
import { DoctorProfile } from './doctor/entities/doctor-profile.entity';
import { PatientProfile } from './patient/entities/patient-profile.entity';
import { RecurringAvailability } from './doctor/entities/recurring-availability.entity';
import { CustomAvailability } from './doctor/entities/custom-availability.entity';
import { Appointment } from './patient/entities/appointment.entity';


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
      entities: [User, DoctorProfile, PatientProfile, RecurringAvailability, CustomAvailability, Appointment],
      synchronize: true, // Auto-sync in dev to fix missing columns
      migrations: ['dist/migrations/*{.ts,.js}'],
      logging: false,
    }),

    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
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
