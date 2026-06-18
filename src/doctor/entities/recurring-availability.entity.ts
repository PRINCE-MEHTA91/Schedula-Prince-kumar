import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { DayOfWeek } from '../enums/day-of-week.enum';

@Entity()
export class RecurringAvailability {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorProfileId: number;

  @ManyToOne(() => DoctorProfile, (profile) => profile.recurringAvailabilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorProfileId' })
  doctorProfile: DoctorProfile;

  @Column({ type: 'enum', enum: DayOfWeek })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
