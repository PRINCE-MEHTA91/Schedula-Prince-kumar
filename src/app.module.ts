import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';

/**
 * Root application module.
 * Registers all feature modules: Auth, Doctor, Patient.
 */
@Module({
  imports: [
    AuthModule,    // Provides signup/login endpoints and JWT infrastructure
    DoctorModule,  // Provides /doctor/profile (DOCTOR role only)
    PatientModule, // Provides /patient/profile (PATIENT role only)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
