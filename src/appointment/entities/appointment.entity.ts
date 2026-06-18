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
import { PatientProfile } from '../../patient/entities/patient-profile.entity';

// Status of the appointment — BOOKED or CANCELLED
export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  // Which doctor is this appointment with
  @ManyToOne(() => DoctorProfile, { eager: false })
  @JoinColumn({ name: 'doctorId' })
  doctor: DoctorProfile;

  @Column()
  doctorId: number;

  // Which patient booked this appointment
  @ManyToOne(() => PatientProfile, { eager: false })
  @JoinColumn({ name: 'patientId' })
  patient: PatientProfile;

  @Column()
  patientId: number;

  // Date of appointment e.g. "2026-06-20"
  @Column()
  date: string;

  // Start time e.g. "10:00"
  @Column()
  startTime: string;

  // End time e.g. "10:15"
  @Column()
  endTime: string;

  // Status — default is BOOKED when created
  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.BOOKED,
  })
  status: AppointmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
