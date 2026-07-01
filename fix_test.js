const fs = require('fs');

const file = 'src/appointment/appointment.service.spec.ts';
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

const validTestsPart1 = lines.slice(103, 403).join('\n');
const validTestsPart2 = lines.slice(407, 517).join('\n');

const newSetup = `import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentService } from './appointment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile, Gender } from '../patient/entities/patient-profile.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/enums/notification-type.enum';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let appointmentRepo: any;
  let doctorRepo: any;
  let patientRepo: any;
  let notificationService: any;
  
  const mockDoctorRepo = {
    findOne: jest.fn(),
  };

  const mockAppointmentRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((appointment) => Promise.resolve({ id: 1, ...appointment })),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockPatientRepo = {
    findOne: jest.fn(),
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(DoctorProfile), useValue: mockDoctorRepo },
        { provide: getRepositoryToken(PatientProfile), useValue: mockPatientRepo },
        { provide: getRepositoryToken(StreamSlot), useValue: {} },
        { provide: getRepositoryToken(WaveSchedule), useValue: {} },
        { provide: getRepositoryToken(RecurringAvailability), useValue: {} },
        { provide: getRepositoryToken(CustomAvailability), useValue: {} },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    appointmentRepo = module.get(getRepositoryToken(Appointment));
    doctorRepo = module.get(getRepositoryToken(DoctorProfile));
    patientRepo = module.get(getRepositoryToken(PatientProfile));
    notificationService = module.get(NotificationService);
  });
`;

const finalContent = newSetup + '\n' + validTestsPart1 + '\n' + validTestsPart2 + '\n});\n';

fs.writeFileSync(file, finalContent);
console.log('Fixed file');
