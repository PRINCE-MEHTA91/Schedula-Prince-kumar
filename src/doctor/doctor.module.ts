import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { AppointmentModule } from '../appointment/appointment.module';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorProfile, RecurringAvailability, CustomAvailability, Appointment]),
    forwardRef(() => AppointmentModule),
  ],
  controllers: [DoctorController, AvailabilityController],
  providers: [DoctorService, AvailabilityService],
  exports: [DoctorService],
})
export class DoctorModule {}
