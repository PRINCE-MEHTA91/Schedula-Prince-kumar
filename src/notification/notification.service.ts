import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
  ) {}

  // ─── Internal: Create a notification for a patient (by patientId directly) ──
  // Called from AppointmentService where patientId is already known.

  async createNotification(
    patientId: number,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      patientId,
      type,
      title,
      message,
    });
    return this.notificationRepo.save(notification);
  }

  // ─── GET /notification/my — Patient views their own notifications ─────────
  // Accepts userId (from JWT), resolves patientId, then fetches notifications.

  async getMyNotifications(userId: number) {
    // Resolve patientId from userId
    const patient = await this.patientRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please complete your profile first.',
      );
    }

    const notifications = await this.notificationRepo.find({
      where: { patientId: patient.id },
      order: { createdAt: 'DESC' }, // Latest first as per business rule
    });

    return {
      message: 'Notifications fetched successfully',
      count: notifications.length,
      notifications,
    };
  }

  // ─── GET /notification/unread-count — Get count of unread notifications ─

  async getUnreadCount(userId: number) {
    const patient = await this.patientRepo.findOne({ where: { userId } });
    if (!patient) {
      return { unreadCount: 0 };
    }

    const unreadCount = await this.notificationRepo.count({
      where: { patientId: patient.id, isRead: false },
    });

    return { unreadCount };
  }

  // ─── PATCH /notification/:id/read — Mark a notification as read ──────────
  // Accepts userId (from JWT), resolves patientId for ownership check.

  async markAsRead(notificationId: number, userId: number) {
    // Resolve patient profile for ownership verification
    const patient = await this.patientRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found.');
    }

    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, patientId: patient.id },
    });

    if (!notification) {
      throw new NotFoundException(
        'Notification not found or you are not authorized to access it.',
      );
    }

    notification.isRead = true;
    await this.notificationRepo.save(notification);

    return { message: 'Notification marked as read' };
  }

  // ─── PATCH /notification/read-all — Mark all notifications as read ──────────
  // Accepts userId (from JWT), resolves patientId for ownership check.

  async markAllAsRead(userId: number) {
    const patient = await this.patientRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found.');
    }

    await this.notificationRepo.update(
      { patientId: patient.id, isRead: false },
      { isRead: true },
    );

    return { message: 'All notifications marked as read' };
  }
}
