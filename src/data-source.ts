import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

import { User } from './auth/user.entity';
import { DoctorProfile } from './doctor/entities/doctor-profile.entity';
import { PatientProfile } from './patient/entities/patient-profile.entity';
import { Appointment } from './appointment/entities/appointment.entity';
import { StreamSlot } from './appointment/entities/stream-slot.entity';
import { WaveSchedule } from './appointment/entities/wave-schedule.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: [User, DoctorProfile, PatientProfile, Appointment, StreamSlot, WaveSchedule],
  entities: [User, DoctorProfile, PatientProfile, DoctorSchedule, AppointmentSlot, WaveBooking],
  entities: [User, DoctorProfile, PatientProfile, Appointment],
  entities: [User, DoctorProfile, PatientProfile, RecurringAvailability, CustomAvailability],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
