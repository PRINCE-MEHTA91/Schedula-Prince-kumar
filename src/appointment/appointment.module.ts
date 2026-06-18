import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { AppointmentSlot } from './entities/appointment-slot.entity';
import { WaveBooking } from './entities/wave-booking.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorSchedule,
      AppointmentSlot,
      WaveBooking,
      DoctorProfile,
      PatientProfile,
    ]),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService],
import { Appointment } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';

@Module({
  // Register all 3 repositories this module needs
  imports: [
    TypeOrmModule.forFeature([Appointment, DoctorProfile, PatientProfile]),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService],
  // Export so DoctorModule can use AppointmentService for GET /doctor/appointments
  exports: [AppointmentService],
})
export class AppointmentModule {}
