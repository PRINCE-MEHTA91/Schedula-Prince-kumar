import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * PatientModule — groups all patient-related functionality.
 * Imports AuthModule to gain access to JwtAuthGuard, RolesGuard, and PassportModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [PatientController],
  providers: [],
})
export class PatientModule {}
