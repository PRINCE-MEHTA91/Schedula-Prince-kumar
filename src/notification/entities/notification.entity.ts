import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Supported notification event types
export enum NotificationType {
  APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  FOLLOW_UP_REMINDER = 'FOLLOW_UP_REMINDER',
}

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
