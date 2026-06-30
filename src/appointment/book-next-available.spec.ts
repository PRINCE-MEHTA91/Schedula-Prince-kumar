/**
 * Unit tests for AppointmentService.bookNextAvailableSlot()
 *
 * Day 13 — Next Available Appointment Booking
 *
 * Scenarios covered:
 *  1.  Doctor not found (invalid ID) → NotFoundException
 *  2.  Doctor isAvailable=false → BadRequestException
 *  3.  Patient profile missing → NotFoundException
 *  4.  Slot is in the past → BadRequestException
 *  5.  Stream slot is free → books successfully (STREAM)
 *  6.  Stream slot already booked (race condition) → falls through to SLOT legacy
 *  7.  Wave schedule has remaining capacity → books successfully (WAVE)
 *  8.  Wave schedule is fully booked → ConflictException
 *  9.  No stream/wave records, slot still free → SLOT fallback booking
 * 10.  No stream/wave records, slot taken by legacy → ConflictException
 * 11.  Wave booking with explicit waveId in DTO
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { BookNextAvailableDto } from './dto/book-next-available.dto';
import { NotificationService } from '../notification/notification.service';

// ─── Shared mock factory ─────────────────────────────────────────────────────
const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// ─── Helper — tomorrow's YYYY-MM-DD ─────────────────────────────────────────
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Base fixtures ────────────────────────────────────────────────────────────
const baseDoctor: Partial<DoctorProfile> = {
  id: 1,
  fullName: 'Dr. Test',
  availabilityHours: 'Mon-Sat 09:00am-05:00pm',
  isAvailable: true,
  slotDuration: 30,
};

const basePatient: Partial<PatientProfile> = {
  id: 10,
  userId: 99,
  fullName: 'Test Patient',
};

// ─── Shared DTO builder ───────────────────────────────────────────────────────
function makeDto(overrides: Partial<BookNextAvailableDto> = {}): BookNextAvailableDto {
  return Object.assign(new BookNextAvailableDto(), {
    doctorId: 1,
    date: tomorrowStr(),
    startTime: '09:00',
    endTime: '09:30',
    ...overrides,
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('AppointmentService.bookNextAvailableSlot()', () => {
  let service: AppointmentService;
  let doctorRepo: ReturnType<typeof mockRepo>;
  let patientRepo: ReturnType<typeof mockRepo>;
  let streamSlotRepo: ReturnType<typeof mockRepo>;
  let waveScheduleRepo: ReturnType<typeof mockRepo>;
  let appointmentRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment), useFactory: mockRepo },
        { provide: getRepositoryToken(DoctorProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(PatientProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(StreamSlot), useFactory: mockRepo },
        { provide: getRepositoryToken(WaveSchedule), useFactory: mockRepo },
        { provide: getRepositoryToken(RecurringAvailability), useFactory: mockRepo },
        { provide: getRepositoryToken(CustomAvailability), useFactory: mockRepo },
        { provide: NotificationService, useValue: { createNotification: jest.fn() } },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    doctorRepo = module.get(getRepositoryToken(DoctorProfile));
    patientRepo = module.get(getRepositoryToken(PatientProfile));
    streamSlotRepo = module.get(getRepositoryToken(StreamSlot));
    waveScheduleRepo = module.get(getRepositoryToken(WaveSchedule));
    appointmentRepo = module.get(getRepositoryToken(Appointment));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Scenario 1: Doctor not found ─────────────────────────────────────────
  it('Scenario 1 — throws NotFoundException when doctor does not exist', async () => {
    doctorRepo.findOne.mockResolvedValue(null);

    await expect(
      service.bookNextAvailableSlot(99, makeDto({ doctorId: 9999 })),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Scenario 2: Doctor unavailable ───────────────────────────────────────
  it('Scenario 2 — throws BadRequestException when doctor isAvailable=false', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor, isAvailable: false });

    await expect(
      service.bookNextAvailableSlot(99, makeDto()),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Scenario 3: Patient profile missing ──────────────────────────────────
  it('Scenario 3 — throws NotFoundException when patient profile is missing', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue(null);

    await expect(
      service.bookNextAvailableSlot(99, makeDto()),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Scenario 4: Slot is in the past ──────────────────────────────────────
  it('Scenario 4 — throws BadRequestException when slot datetime is in the past', async () => {
    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });

    // Use a past date
    const pastDto = makeDto({ date: '2020-01-01', startTime: '09:00', endTime: '09:30' });

    await expect(
      service.bookNextAvailableSlot(99, pastDto),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Scenario 5: Stream slot available → books STREAM ─────────────────────
  it('Scenario 5 — books STREAM slot when StreamSlot is free', async () => {
    const date = tomorrowStr();
    const freeStreamSlot = {
      id: 1,
      doctorId: 1,
      date,
      startTime: '09:00',
      endTime: '09:30',
      isAvailable: true,
      isBooked: false,
    };
    const savedAppointment = {
      id: 100,
      doctorId: 1,
      patientId: 10,
      date,
      startTime: '09:00',
      endTime: '09:30',
      status: AppointmentStatus.BOOKED,
    };

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });
    streamSlotRepo.findOne.mockResolvedValue(freeStreamSlot);
    streamSlotRepo.save.mockResolvedValue({ ...freeStreamSlot, isBooked: true });
    appointmentRepo.create.mockReturnValue(savedAppointment);
    appointmentRepo.save.mockResolvedValue(savedAppointment);

    const result = await service.bookNextAvailableSlot(99, makeDto({ date }));

    expect(result.schedulingType).toBe('STREAM');
    expect(result.message).toContain('STREAM');
    expect(result.appointment).toBeDefined();
    expect(streamSlotRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ isBooked: true }),
    );
  });

  // ─── Scenario 6: Stream slot just taken (race condition) → SLOT fallback ──
  it('Scenario 6 — falls through to SLOT fallback when StreamSlot is gone', async () => {
    const date = tomorrowStr();
    const savedAppointment = {
      id: 101,
      doctorId: 1,
      patientId: 10,
      date,
      startTime: '09:00',
      endTime: '09:30',
      status: AppointmentStatus.BOOKED,
    };

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });
    streamSlotRepo.findOne.mockResolvedValue(null);  // slot gone
    waveScheduleRepo.findOne.mockResolvedValue(null); // no wave either
    appointmentRepo.findOne.mockResolvedValue(null);  // not taken by legacy
    appointmentRepo.create.mockReturnValue(savedAppointment);
    appointmentRepo.save.mockResolvedValue(savedAppointment);

    const result = await service.bookNextAvailableSlot(99, makeDto({ date }));

    expect(result.schedulingType).toBe('SLOT');
    expect(result.message).toContain('SLOT');
  });

  // ─── Scenario 7: Wave has remaining capacity → books WAVE ─────────────────
  it('Scenario 7 — books WAVE when wave has remaining capacity', async () => {
    const date = tomorrowStr();
    const wave = {
      id: 5,
      doctorId: 1,
      date,
      startTime: '14:00',
      endTime: '15:00',
      capacity: 10,
      bookedCount: 6,
    };
    const savedAppointment = {
      id: 102,
      doctorId: 1,
      patientId: 10,
      date,
      startTime: '14:00',
      endTime: '15:00',
      status: AppointmentStatus.BOOKED,
    };

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });
    streamSlotRepo.findOne.mockResolvedValue(null); // no stream slot
    waveScheduleRepo.findOne.mockResolvedValue(wave);
    waveScheduleRepo.save.mockResolvedValue({ ...wave, bookedCount: 7 });
    appointmentRepo.create.mockReturnValue(savedAppointment);
    appointmentRepo.save.mockResolvedValue(savedAppointment);

    const result = await service.bookNextAvailableSlot(
      99,
      makeDto({ date, startTime: '14:00', endTime: '15:00' }),
    );

    expect(result.schedulingType).toBe('WAVE');
    expect(result.message).toContain('WAVE');
    expect(result.waveToken).toBe(7); // bookedCount after increment
    expect(waveScheduleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ bookedCount: 7 }),
    );
  });

  // ─── Scenario 8: Wave fully booked → ConflictException ────────────────────
  it('Scenario 8 — throws ConflictException when wave is fully booked', async () => {
    const date = tomorrowStr();
    const fullWave = {
      id: 6,
      doctorId: 1,
      date,
      startTime: '14:00',
      endTime: '15:00',
      capacity: 5,
      bookedCount: 5, // fully booked
    };

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });
    streamSlotRepo.findOne.mockResolvedValue(null);
    waveScheduleRepo.findOne.mockResolvedValue(fullWave);

    await expect(
      service.bookNextAvailableSlot(
        99,
        makeDto({ date, startTime: '14:00', endTime: '15:00' }),
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ─── Scenario 9: Legacy SLOT fallback — slot free ─────────────────────────
  it('Scenario 9 — uses legacy SLOT path when no stream/wave records exist', async () => {
    const date = tomorrowStr();
    const savedAppointment = {
      id: 103,
      doctorId: 1,
      patientId: 10,
      date,
      startTime: '10:00',
      endTime: '10:30',
      status: AppointmentStatus.BOOKED,
    };

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });
    streamSlotRepo.findOne.mockResolvedValue(null);  // no stream slot
    waveScheduleRepo.findOne.mockResolvedValue(null); // no wave
    appointmentRepo.findOne.mockResolvedValue(null);  // not already booked
    appointmentRepo.create.mockReturnValue(savedAppointment);
    appointmentRepo.save.mockResolvedValue(savedAppointment);

    const result = await service.bookNextAvailableSlot(
      99,
      makeDto({ date, startTime: '10:00', endTime: '10:30' }),
    );

    expect(result.schedulingType).toBe('SLOT');
    expect(result.appointment.status).toBe(AppointmentStatus.BOOKED);
  });

  // ─── Scenario 10: Legacy SLOT taken → ConflictException ───────────────────
  it('Scenario 10 — throws ConflictException when legacy slot was just taken', async () => {
    const date = tomorrowStr();

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });
    streamSlotRepo.findOne.mockResolvedValue(null);
    waveScheduleRepo.findOne.mockResolvedValue(null);
    // Slot already claimed by another patient
    appointmentRepo.findOne.mockResolvedValue({
      id: 999,
      doctorId: 1,
      date,
      startTime: '10:00',
      status: AppointmentStatus.BOOKED,
    });

    await expect(
      service.bookNextAvailableSlot(
        99,
        makeDto({ date, startTime: '10:00', endTime: '10:30' }),
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ─── Scenario 11: Wave booking with explicit waveId ───────────────────────
  it('Scenario 11 — uses waveId from DTO to select exact wave schedule', async () => {
    const date = tomorrowStr();
    const wave = {
      id: 7,
      doctorId: 1,
      date,
      startTime: '16:00',
      endTime: '17:00',
      capacity: 20,
      bookedCount: 10,
    };
    const savedAppointment = {
      id: 104,
      doctorId: 1,
      patientId: 10,
      date,
      startTime: '16:00',
      endTime: '17:00',
      status: AppointmentStatus.BOOKED,
    };

    doctorRepo.findOne.mockResolvedValue({ ...baseDoctor });
    patientRepo.findOne.mockResolvedValue({ ...basePatient });
    streamSlotRepo.findOne.mockResolvedValue(null);
    waveScheduleRepo.findOne.mockResolvedValue(wave);
    waveScheduleRepo.save.mockResolvedValue({ ...wave, bookedCount: 11 });
    appointmentRepo.create.mockReturnValue(savedAppointment);
    appointmentRepo.save.mockResolvedValue(savedAppointment);

    const result = await service.bookNextAvailableSlot(
      99,
      makeDto({ date, startTime: '16:00', endTime: '17:00', waveId: 7 }),
    );

    expect(result.schedulingType).toBe('WAVE');
    expect(result.waveToken).toBe(11);
    // Verify waveScheduleRepo.findOne was called with waveId filter
    expect(waveScheduleRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 7 }),
      }),
    );
  });
});
