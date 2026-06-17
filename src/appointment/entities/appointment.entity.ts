import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { StreamSlot } from './stream-slot.entity';
import { WaveSchedule } from './wave-schedule.entity';

export enum SchedulingType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Patient ────────────────────────────────────────────────────────────────

  @Column()
  patientId: number;

  @ManyToOne(() => PatientProfile, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: PatientProfile;

  // ─── Doctor ─────────────────────────────────────────────────────────────────

  @Column()
  doctorId: number;

  @ManyToOne(() => DoctorProfile, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: DoctorProfile;

  // ─── Scheduling Type ────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: SchedulingType })
  schedulingType: SchedulingType;

  // ─── Stream Slot (nullable — only set for STREAM type) ──────────────────────

  @Column({ nullable: true })
  streamSlotId: number | null;

  @ManyToOne(() => StreamSlot, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'streamSlotId' })
  streamSlot: StreamSlot | null;

  // ─── Wave Schedule (nullable — only set for WAVE type) ──────────────────────

  @Column({ nullable: true })
  waveScheduleId: number | null;

  @ManyToOne(() => WaveSchedule, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'waveScheduleId' })
  waveSchedule: WaveSchedule | null;

  /**
   * Sequential token number within the wave (1, 2, 3...).
   * Null for STREAM appointments.
   */
  @Column({ type: 'int', nullable: true })
  waveToken: number | null;

  // ─── Appointment Time (denormalized for quick access) ───────────────────────

  @Column({ type: 'date' })
  appointmentDate: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  // ─── Status ─────────────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.CONFIRMED,
  })
  status: AppointmentStatus;

  // ─── Optional Notes ─────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
