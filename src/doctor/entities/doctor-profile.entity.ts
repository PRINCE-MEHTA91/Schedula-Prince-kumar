import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/user.entity';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { OneToMany } from 'typeorm';

@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullName: string;

  @Column()
  specialization: string;

  @Column({ type: 'int' })
  experience: number;

  @Column()
  qualification: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  consultationFee: number;

  @Column({ type: 'text' })
  availabilityHours: string;

  @Column({ type: 'text', nullable: true })
  profileDetails: string;

  // Doctor abhi appointments le raha hai ya nahi — default: true (available)
  @Column({ default: true })
  isAvailable: boolean;

  @Column({ type: 'int', default: 15 })
  slotDuration: number; // in minutes

  @Column({ type: 'enum', enum: ['STREAM', 'WAVE'], default: 'STREAM' })
  schedulingType: string;

  @Column({ type: 'int', default: 0 })
  bufferTime: number; // in minutes (for STREAM scheduling)

  @Column({ type: 'int', nullable: true })
  maxPatientsPerWave: number; // for WAVE scheduling

  // ── Day 20: Future Booking Configuration ──────────────────────────────────
  // false = same-day only (default); true = allow future dates
  @Column({ default: false })
  allowFutureBooking: boolean;

  // Max days ahead patients can book. null/0 → falls back to 7-day default.
  @Column({ type: 'int', nullable: true })
  maxFutureBookingDays: number | null;

  @OneToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @OneToMany(
    () => RecurringAvailability,
    (availability) => availability.doctorProfile,
  )
  recurringAvailabilities: RecurringAvailability[];

  @OneToMany(
    () => CustomAvailability,
    (availability) => availability.doctorProfile,
  )
  customAvailabilities: CustomAvailability[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
