import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { DoctorSchedule } from './doctor-schedule.entity';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';

@Entity('wave_bookings')
export class WaveBooking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number;

  @ManyToOne(() => DoctorSchedule, (schedule) => schedule.waveBookings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'scheduleId' })
  schedule: DoctorSchedule;

  @Column()
  patientId: number;

  @ManyToOne(() => PatientProfile, { eager: false })
  @JoinColumn({ name: 'patientId' })
  patient: PatientProfile;

  // Auto-assigned in booking order: 1, 2, 3 ...
  @Column({ type: 'int' })
  tokenNumber: number;

  @CreateDateColumn()
  bookedAt: Date;
}
