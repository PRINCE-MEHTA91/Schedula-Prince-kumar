import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

import { User } from './auth/user.entity';
import { DoctorProfile } from './doctor/entities/doctor-profile.entity';
import { PatientProfile } from './patient/entities/patient-profile.entity';
import { Appointment } from './appointment/entities/appointment.entity';
import { RecurringAvailability } from './doctor/entities/recurring-availability.entity';
import { CustomAvailability } from './doctor/entities/custom-availability.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: [User, DoctorProfile, PatientProfile, Appointment],
  entities: [User, DoctorProfile, PatientProfile, RecurringAvailability, CustomAvailability],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
