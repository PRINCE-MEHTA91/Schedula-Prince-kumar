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

@Entity()
export class CustomAvailability {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorProfileId: number;

  @ManyToOne(() => DoctorProfile, (profile) => profile.customAvailabilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorProfileId' })
  doctorProfile: DoctorProfile;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
