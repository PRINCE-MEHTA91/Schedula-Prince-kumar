import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/enums/notification-type.enum';

/**
 * AppointmentReminderService
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs a Cron Job every minute to find upcoming CONFIRMED appointments and
 * dispatch a one-time reminder notification to the patient.
 *
 * Business Rules:
 *  - Only CONFIRMED appointments get reminders.
 *  - CANCELLED or any non-CONFIRMED appointment is skipped.
 *  - Reminders are sent only once (isReminderSent flag).
 *  - Reminder window: appointment is within the next 24 hours.
 *  - Stream: includes Doctor Name, Appointment Date, Appointment Time.
 *  - Wave:   includes Doctor Name, Reporting Time, Token Number.
 */
@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cron Job — runs every minute.
   * Fetches upcoming CONFIRMED appointments that haven't been reminded yet
   * and sends a one-time reminder notification.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.log('[ReminderCron] Running appointment reminder check...');

    try {
      // Today's date string in local YYYY-MM-DD format (avoids UTC-offset issues)
      const now = new Date();
      const todayString = this.toLocalDateString(now);

      // Fetch CONFIRMED appointments for today or later with no reminder sent.
  
      const candidates = await this.appointmentRepo
        .createQueryBuilder('appointment')
        .leftJoinAndSelect('appointment.doctor', 'doctor')
        .where('appointment.status = :status', {
          status: AppointmentStatus.CONFIRMED,
        })
        .andWhere('appointment.isReminderSent = :sent', { sent: false })
        .andWhere('appointment.date >= :today', { today: todayString })
        .getMany();

      if (candidates.length === 0) {
        this.logger.log('[ReminderCron] No pending reminders found.');
        return;
      }

      this.logger.log(
        `[ReminderCron] Found ${candidates.length} candidate appointment(s).`,
      );

      let sentCount = 0;
      let skippedCount = 0;

      for (const appointment of candidates) {
        // ── Edge Case: Invalid / missing data ─────────────────────────────
        if (!appointment.date || !appointment.startTime) {
          this.logger.warn(
            `[ReminderCron] Appointment #${appointment.id} has missing date/time — skipping.`,
          );
          skippedCount++;
          continue;
        }

        // ── Guard: double-check status (race condition safety) ────────────
        if (appointment.status !== AppointmentStatus.CONFIRMED) {
          this.logger.warn(
            `[ReminderCron] Appointment #${appointment.id} is ${appointment.status} — skipping.`,
          );
          skippedCount++;
          continue;
        }

        // ── Guard: reminder already sent (race condition safety) ──────────
        if (appointment.isReminderSent) {
          this.logger.warn(
            `[ReminderCron] Appointment #${appointment.id} reminder already sent — skipping.`,
          );
          skippedCount++;
          continue;
        }

        // ── Check 24-hour reminder window ─────────────────────────────────
        const appointmentDateTimeStr = `${appointment.date}T${appointment.startTime}:00`;
        const appointmentDateTime = new Date(appointmentDateTimeStr);
        const timeDiffMs = appointmentDateTime.getTime() - now.getTime();
        const hoursDiff = timeDiffMs / (1000 * 60 * 60);

        if (hoursDiff <= 0) {
          this.logger.warn(
            `[ReminderCron] Appointment #${appointment.id} time has already passed — skipping.`,
          );
          skippedCount++;
          continue;
        }

        if (hoursDiff > 24) {
          // Not within the 24-hour window yet — will be picked up in a later tick
          skippedCount++;
          continue;
        }

        // ── Send reminder ─────────────────────────────────────────────────
        const sent = await this.sendReminder(appointment);
        if (sent) {
          sentCount++;
        } else {
          skippedCount++;
        }
      }

      this.logger.log(
        `[ReminderCron] Done. Sent: ${sentCount}, Skipped/Errors: ${skippedCount}.`,
      );
    } catch (error) {
      this.logger.error(
        '[ReminderCron] Unexpected error during reminder check.',
        error?.stack,
      );
    }
  }

  /**
   * Build and dispatch the reminder notification for a single appointment.
   * Marks isReminderSent = true after successful dispatch.
   * Returns true on success, false on failure.
   */
  private async sendReminder(appointment: Appointment): Promise<boolean> {
    try {
      const doctorName = appointment.doctor?.fullName?.trim() || 'your doctor';
      // schedulingType lives on the doctor profile, not the appointment
      const schedulingType = (appointment.doctor?.schedulingType || 'STREAM').toUpperCase();

      let message: string;

      if (schedulingType === 'WAVE') {
        // ── Wave Scheduling Reminder ──────────────────────────────────────
        const reportingTime = this.formatTime(appointment.startTime);
        const tokenNumber = appointment.tokenNumber ?? 'N/A';
        message =
          `Reminder: You have an appointment with Dr. ${doctorName} today.\n\n` +
          `Reporting Time: ${reportingTime}\n\n` +
          `Token Number: ${tokenNumber}`;
      } else {
        // ── Stream Scheduling Reminder (default) ──────────────────────────
        const appointmentTime = this.formatTime(appointment.startTime);
        message =
          `Reminder: You have an appointment with Dr. ${doctorName} today.\n\n` +
          `Appointment Date: ${appointment.date}\n\n` +
          `Appointment Time: ${appointmentTime}`;
      }

      // Create the notification record in the DB
      await this.notificationService.createNotification({
        patientId: appointment.patientId,
        title: 'Appointment Reminder',
        message,
        type: NotificationType.APPOINTMENT_REMINDER,
      });

      // Mark as sent to prevent duplicates
      appointment.isReminderSent = true;
      await this.appointmentRepo.save(appointment);

      this.logger.log(
        `[ReminderCron] Reminder sent for appointment #${appointment.id} ` +
        `(Patient: ${appointment.patientId}, Type: ${schedulingType}).`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[ReminderCron] Failed to send reminder for appointment #${appointment.id}.`,
        error?.stack,
      );
      return false;
    }
  }

  /**
   * Formats a 24-hour time string "HH:mm" to 12-hour "hh:mm AM/PM".
   * Returns empty string for null/undefined input.
   */
  private formatTime(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hour = parseInt(parts[0], 10);
    const min = parts[1];
    if (isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour;
    const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
    return `${hourStr}:${min} ${ampm}`;
  }

  /**
   * Returns a YYYY-MM-DD string in LOCAL time (avoids UTC-offset date-shifting).
   */
  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
