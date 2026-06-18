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

@Entity('appointment_slots')
export class AppointmentSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number;

  @ManyToOne(() => DoctorSchedule, (schedule) => schedule.slots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'scheduleId' })
  schedule: DoctorSchedule;

  // HH:MM
  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  @Column({ default: false })
  isBooked: boolean;

  @Column({ type: 'int', nullable: true })
  patientId: number | null;

  @ManyToOne(() => PatientProfile, { nullable: true, eager: false })
  @JoinColumn({ name: 'patientId' })
  patient: PatientProfile;

  @CreateDateColumn()
  createdAt: Date;
}
