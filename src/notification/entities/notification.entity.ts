import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * Persisted record for every in-app notification sent to a patient.
 *
 * DB table: notifications
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  // Which patient this notification belongs to
  @Column()
  patientId: number;

  // Notification category — drives filtering and UI icons
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  // Short heading shown in notification list
  @Column()
  title: string;

  // Full human-readable message body
  @Column({ type: 'text' })
  message: string;

  // Whether the patient has read/dismissed the notification
  @Column({ default: false })
  isRead: boolean;

  // Auto-set on creation — used for ordering (latest first)
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
