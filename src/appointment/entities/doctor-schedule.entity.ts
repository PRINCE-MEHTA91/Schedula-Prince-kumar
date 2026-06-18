import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { AppointmentSlot } from './appointment-slot.entity';
import { WaveBooking } from './wave-booking.entity';

export enum SchedulingType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

@Entity('doctor_schedules')
export class DoctorSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorId: number;

  @ManyToOne(() => DoctorProfile)
  @JoinColumn({ name: 'doctorId' })
  doctor: DoctorProfile;

  @Column({ type: 'enum', enum: SchedulingType })
  schedulingType: SchedulingType;

  // Calendar date (YYYY-MM-DD)
  @Column({ type: 'date' })
  date: string;

  // HH:MM
  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  // ─── STREAM only ─────────────────────────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  slotDuration: number | null;

  @Column({ type: 'int', nullable: true })
  bufferTime: number | null;

  // ─── WAVE only ───────────────────────────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  maxCapacity: number | null;

  @OneToMany(() => AppointmentSlot, (slot) => slot.schedule, { cascade: true })
  slots: AppointmentSlot[];

  @OneToMany(() => WaveBooking, (booking) => booking.schedule, { cascade: true })
  waveBookings: WaveBooking[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
