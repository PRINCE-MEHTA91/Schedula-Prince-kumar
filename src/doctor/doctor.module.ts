import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorProfile]),
    // forwardRef to avoid circular dependency (AppointmentModule also imports DoctorProfile)
    forwardRef(() => AppointmentModule),
  ],
  controllers: [DoctorController],
  providers: [DoctorService],
  exports: [DoctorService],
})
export class DoctorModule {}
