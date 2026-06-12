import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';

@Entity('recurring_availability')
export class RecurringAvailability {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorId: number;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: DoctorProfile;

  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  @Column({ type: 'int' })
  dayOfWeek: number;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
