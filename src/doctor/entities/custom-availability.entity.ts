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

@Entity('custom_availability')
export class CustomAvailability {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorId: number;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: DoctorProfile;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  @Column({ default: true })
  isAvailable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
