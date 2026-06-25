import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      PatientProfile, // needed by NotificationService to resolve patientId from userId
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  // Export so AppointmentModule can inject NotificationService
  exports: [NotificationService],
})
export class NotificationModule {}
