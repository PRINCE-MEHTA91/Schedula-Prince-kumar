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
 * Represents a wave (batch) scheduling window created by a doctor.
 * Multiple patients can book within the same wave up to `capacity`.
 * Each booked patient gets a sequential token number.
 */
@Entity('wave_schedules')
export class WaveSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorId: number;

  @ManyToOne(() => DoctorProfile, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: DoctorProfile;

  /** The calendar date of this wave (date only). */
  @Column({ type: 'date' })
  date: string;

  /** Wave start time, e.g. "14:00" */
  @Column({ type: 'time' })
  startTime: string;

  /** Wave end time, e.g. "15:00" */
  @Column({ type: 'time' })
  endTime: string;

  /** Maximum number of patients for this wave. */
  @Column({ type: 'int' })
  capacity: number;

  /**
   * Current number of confirmed bookings.
   * isFull is derived: bookedCount >= capacity.
   */
  @Column({ type: 'int', default: 0 })
  bookedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
