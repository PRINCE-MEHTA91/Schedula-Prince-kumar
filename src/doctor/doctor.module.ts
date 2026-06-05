import { Module } from '@nestjs/common';
import { DoctorController } from './doctor.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * DoctorModule — groups all doctor-related functionality.
 * Imports AuthModule to gain access to JwtAuthGuard, RolesGuard, and PassportModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [DoctorController],
  providers: [],
})
export class DoctorModule {}
