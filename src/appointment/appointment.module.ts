import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { AppointmentService } from './appointment.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import { AppointmentController } from './appointment.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      DoctorProfile,
      PatientProfile,
      StreamSlot,
      WaveSchedule,
      RecurringAvailability,
      CustomAvailability,
    ]),
    // Import NotificationModule so AppointmentService can inject NotificationService
    NotificationModule,
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, AppointmentReminderService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
