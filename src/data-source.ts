import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

import { User } from './auth/user.entity';
import { DoctorProfile } from './doctor/entities/doctor-profile.entity';
import { PatientProfile } from './patient/entities/patient-profile.entity';
import { Appointment } from './appointment/entities/appointment.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: [User, DoctorProfile, PatientProfile, Appointment],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
