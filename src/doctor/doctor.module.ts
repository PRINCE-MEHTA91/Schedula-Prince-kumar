import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorProfile,
      RecurringAvailability,
      CustomAvailability,
    ]),
  ],
  controllers: [AvailabilityController, DoctorController],
  providers: [DoctorService, AvailabilityService],
})
export class DoctorModule {}
