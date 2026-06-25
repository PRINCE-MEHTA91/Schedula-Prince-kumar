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

// Matches the actual DB enum: appointments_status_enum
export enum AppointmentStatus {
  BOOKED = 'CONFIRMED',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
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
  // Date of appointment e.g. "2026-06-20" — maps to DB column "appointmentDate"
  @Column({ name: 'appointmentDate' })
  date: string;

  // Start time e.g. "10:00"
  @Column()
  startTime: string;

  // End time e.g. "10:15"
  @Column()
  endTime: string;

  // Scheduling type — STREAM or WAVE (nullable for backwards compat)
  @Column({ nullable: true })
  schedulingType: string;

  // Optional notes
  @Column({ nullable: true })
  notes: string;

  // Token number assigned to the patient (only for WAVE scheduling)
  @Column({ type: 'int', nullable: true })
  tokenNumber: number | null;

  // Status — matches real DB enum
  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.CONFIRMED,
  })
  status: AppointmentStatus;

  // Token number assigned to the patient (only for WAVE scheduling)
  @Column({ type: 'int', nullable: true })
  tokenNumber: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
