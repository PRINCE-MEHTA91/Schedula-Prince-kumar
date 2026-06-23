import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
  ) {}

  // ─── Internal helper called by other services ─────────────────────────────

  /**
   * Creates a new notification record.
   * Called internally by AppointmentService after book/cancel/reschedule.
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      patientId: dto.patientId,
      title: dto.title,
      message: dto.message,
      type: dto.type,
      isRead: false,
    });
    return this.notificationRepo.save(notification);
  }

  // ─── 1. GET /notifications — patient's own list ───────────────────────────

  /**
   * Returns all notifications for the authenticated patient,
   * ordered by newest first.
   */
  async getMyNotifications(patientUserId: number) {
    const patient = await this.getPatientOrThrow(patientUserId);

    const notifications = await this.notificationRepo.find({
      where: { patientId: patient.id },
      order: { createdAt: 'DESC' },
    });

    if (notifications.length === 0) {
      return {
        message: 'You have no notifications yet.',
        notifications: [],
      };
    }

    return {
      message: 'Notifications fetched successfully',
      notifications,
    };
  }

  // ─── 2. PATCH /notifications/:id/read — mark single as read ───────────────

  /**
   * Marks a specific notification as read.
   * Throws ForbiddenException if the notification belongs to a different patient.
   */
  async markAsRead(notificationId: number, patientUserId: number) {
    const patient = await this.getPatientOrThrow(patientUserId);

    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found.`,
      );
    }

    if (notification.patientId !== patient.id) {
      throw new ForbiddenException(
        'You are not authorized to update this notification.',
      );
    }

    if (notification.isRead) {
      return {
        message: 'Notification is already marked as read.',
        notification,
      };
    }

    notification.isRead = true;
    const updated = await this.notificationRepo.save(notification);

    return {
      message: 'Notification marked as read.',
      notification: updated,
    };
  }

  // ─── 3. PATCH /notifications/read-all — mark all as read ──────────────────

  /**
   * Marks every unread notification for this patient as read in one query.
   */
  async markAllAsRead(patientUserId: number) {
    const patient = await this.getPatientOrThrow(patientUserId);

    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('patientId = :patientId AND isRead = false', {
        patientId: patient.id,
      })
      .execute();

    const affected = result.affected ?? 0;

    return {
      message:
        affected > 0
          ? `${affected} notification(s) marked as read.`
          : 'No unread notifications to mark.',
      updatedCount: affected,
    };
  }

  // ─── 4. GET /notifications/unread-count — unread badge count ──────────────

  /**
   * Returns the count of unread notifications for the authenticated patient.
   * Intended for badge counters in the UI.
   */
  async getUnreadCount(patientUserId: number) {
    const patient = await this.getPatientOrThrow(patientUserId);

    const count = await this.notificationRepo.count({
      where: { patientId: patient.id, isRead: false },
    });

    return {
      message: 'Unread notification count fetched successfully',
      unreadCount: count,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getPatientOrThrow(userId: number): Promise<PatientProfile> {
    const patient = await this.patientRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please complete your profile first.',
      );
    }
    return patient;
  }
}
