import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { Appointment } from './entities/appointment.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      StreamSlot,
      WaveSchedule,
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
