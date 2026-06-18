import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';

/**
 * Represents a fixed time slot created by a doctor.
 * A patient can book exactly one slot; once booked, isBooked = true.
 */
@Entity('stream_slots')
export class StreamSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorId: number;

  @ManyToOne(() => DoctorProfile, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: DoctorProfile;

  /** The calendar date of this slot (date only, no time). */
  @Column({ type: 'date' })
  date: string;

  /** Slot start time, e.g. "09:00" */
  @Column({ type: 'time' })
  startTime: string;

  /** Slot end time, e.g. "09:15" */
  @Column({ type: 'time' })
  endTime: string;

  /**
   * Whether the doctor has made this slot available for bookings.
   * A doctor can mark a slot unavailable without deleting it.
   */
  @Column({ default: true })
  isAvailable: boolean;

  /**
   * Whether a patient has booked this slot.
   * When a patient books: isBooked = true.
   * When patient cancels/reschedules away: isBooked = false.
   */
  @Column({ default: false })
  isBooked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
