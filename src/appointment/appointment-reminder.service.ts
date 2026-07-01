import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/enums/notification-type.enum';

@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly notificationService: NotificationService,
  ) {}

  // Run periodically to check for upcoming appointments
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug('Running automated appointment reminder cron job...');
    
    const today = new Date();
    const dateString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    try {
      const upcomingAppointments = await this.appointmentRepo.find({
        where: {
          date: dateString,
          status: AppointmentStatus.CONFIRMED,
          isReminderSent: false,
        },
        relations: { doctor: true, patient: true },
      });

      if (upcomingAppointments.length === 0) {
        return;
      }

      this.logger.log(`Found ${upcomingAppointments.length} upcoming appointments to remind.`);

      for (const appt of upcomingAppointments) {
        try {
          await this.sendReminder(appt);
        } catch (err) {
          this.logger.error(`Failed to send reminder for appointment ${appt.id}`, err);
        }
      }
    } catch (err) {
      this.logger.error('Error fetching appointments for reminder cron:', err);
    }
  }

  private async sendReminder(appointment: Appointment) {
    const { doctor, patient, schedulingType } = appointment;
    
    let message = '';
    if (schedulingType?.toUpperCase() === 'WAVE') {
      message = `Reminder: You have an appointment with Dr. ${doctor.fullName} today.\n\nReporting Time: ${appointment.startTime}\nToken Number: ${appointment.tokenNumber || 'N/A'}`;
    } else {
      // Default to STREAM format
      const formattedDate = new Date(appointment.date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      message = `Reminder: You have an appointment with Dr. ${doctor.fullName} on ${formattedDate} at ${appointment.startTime}.`;
    }

    await this.notificationService.createNotification({
      patientId: patient.id,
      type: NotificationType.APPOINTMENT_REMINDER,
      title: 'Upcoming Appointment Reminder',
      message,
    });

    // Mark as sent to ensure we only send it once
    appointment.isReminderSent = true;
    await this.appointmentRepo.save(appointment);
    this.logger.log(`Reminder sent for appointment ${appointment.id}`);
  }
}
