import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
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

  /** The patient this notification belongs to (FK → patient_profiles.id) */
  @Column()
  patientId: number;

  @ManyToOne(() => PatientProfile, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: PatientProfile;

  /** Short heading shown in the notification list */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** Full notification body text */
  @Column({ type: 'text' })
  message: string;

  /** Which event triggered this notification */
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  /** false = unread (default), true = patient has opened/read it */
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  /** Timestamp when the notification was created — used for ordering */
  @CreateDateColumn()
  createdAt: Date;
}
