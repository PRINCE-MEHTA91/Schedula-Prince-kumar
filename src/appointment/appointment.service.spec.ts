/**
 * Appointment Service – Unit Tests
 *
 * Coverage:
 *  - Day 16: Today-only booking validation
 *  - Day 19: Time-based booking window
 *      • Opens  2 hours before consultation start
 *      • Closes 1 hour  before consultation end
 *  - Edge cases: doctor not found, patient not found, slot conflict,
 *                unauthorized cancel, already-cancelled, invalid dates.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppointmentService } from './appointment.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { NotificationService } from '../notification/notification.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns today's date in YYYY-MM-DD (local time) */
function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns tomorrow's date in YYYY-MM-DD (local time) */
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Builds an availabilityHours string such that the booking window
 * (open: consultStart - 2h, close: consultEnd - 1h) contains the current time.
 *
 * Strategy: consultStart = max(now - 3h, 0), consultEnd = min(now + 3h, 23).
 * This guarantees bookOpen is in the past and bookClose is in the future.
 * Falls back to a wide window (00:00am – 11:00pm) at extreme hours.
 */
function buildAvailHoursForOpenWindow(): string {
  const now = new Date();
  const h = now.getHours();
  const startH = Math.max(h - 3, 0);
  const endH   = Math.min(h + 3, 22);  // cap at 22 so consultEnd ≤ 23:00

  // Ensure at least a 2h gap between start and end (required for a valid window)
  if (endH <= startH + 1) {
    // Fallback: a very wide window guaranteed to include any reasonable time
    return 'Mon-Sun 12:00am-11:00pm';
  }

  const fmtAMPM = (x: number) => {
    const ampm = x < 12 ? 'am' : 'pm';
    const h12  = x % 12 === 0 ? 12 : x % 12;
    return `${String(h12).padStart(2, '0')}:00${ampm}`;
  };
  return `Mon-Sun ${fmtAMPM(startH)}-${fmtAMPM(endH)}`;
}

/**
 * Builds an availabilityHours string where the booking window
 * has NOT opened yet (consultStart is > 2h in the future).
 *
 * Strategy: consultStart = now + 3h, consultEnd = now + 6h (both clamped to ≤ 23).
 */
function buildAvailHoursForBeforeWindow(): string {
  const now = new Date();
  const h = now.getHours();
  // consultStart = now + 3h  → bookOpen = now + 1h (future)
  const startH = Math.min(h + 3, 20);  // cap so endH ≤ 23
  const endH   = Math.min(startH + 3, 23);

  const fmtAMPM = (x: number) => {
    const ampm = x < 12 ? 'am' : 'pm';
    const h12  = x % 12 === 0 ? 12 : x % 12;
    return `${String(h12).padStart(2, '0')}:00${ampm}`;
  };
  return `Mon-Sun ${fmtAMPM(startH)}-${fmtAMPM(endH)}`;
}

/**
 * Builds an availabilityHours string where the booking window
 * has already closed (consultEnd <= 1h ago).
 *
 * Strategy: consultEnd = now - 2h → bookClose = now - 1h (past).
 * Clamps to safe ranges and falls back to a guaranteed-closed window at early hours.
 */
function buildAvailHoursForAfterWindow(): string {
  const now = new Date();
  const h = now.getHours();

  // If it's too early in the day to construct a "closed" window,
  // use fixed times that will always be in the past relative to any realistic server start.
  if (h < 3) {
    // At 00:00–02:59 it's impossible to have a window that closed before midnight;
    // return a window that ended at midnight (00:00) — bookClose = -60 min → always closed.
    // parseAvailability: "Mon-Sun 12:00am-01:00am" → consultEnd=60min, bookClose=0min
    // At h=0 (midnight) currentMin=0, bookClose=0 → 0 >= 0 → closed ✓
    return 'Mon-Sun 12:00am-01:00am';
  }

  // consultEnd = now - 2h → bookClose = now - 1h (safely in the past)
  const endH   = Math.max(h - 2, 1);
  const startH = Math.max(endH - 3, 0);

  const fmtAMPM = (x: number) => {
    const ampm = x < 12 ? 'am' : 'pm';
    const h12  = x % 12 === 0 ? 12 : x % 12;
    return `${String(h12).padStart(2, '0')}:00${ampm}`;
  };
  return `Mon-Sun ${fmtAMPM(startH)}-${fmtAMPM(endH)}`;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AppointmentService', () => {
  let service: AppointmentService;

  // ── Mock Repositories ────────────────────────────────────────────────────
  const mockAppointmentRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest
      .fn()
      .mockImplementation((appt) => Promise.resolve({ id: 1, ...appt })),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockDoctorRepo    = { findOne: jest.fn() };
  const mockPatientRepo   = { findOne: jest.fn() };
  const mockStreamSlotRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
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
  const mockWaveScheduleRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
  const mockRecurringAvailRepo = { find: jest.fn().mockResolvedValue([]) };
  const mockCustomAvailRepo    = { find: jest.fn().mockResolvedValue([]) };
  const mockNotificationService = { createNotification: jest.fn() };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment),            useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(DoctorProfile),          useValue: mockDoctorRepo },
        { provide: getRepositoryToken(PatientProfile),         useValue: mockPatientRepo },
        { provide: getRepositoryToken(StreamSlot),             useValue: mockStreamSlotRepo },
        { provide: getRepositoryToken(WaveSchedule),           useValue: mockWaveScheduleRepo },
        { provide: getRepositoryToken(RecurringAvailability),  useValue: mockRecurringAvailRepo },
        { provide: getRepositoryToken(CustomAvailability),     useValue: mockCustomAvailRepo },
        { provide: NotificationService,                        useValue: mockNotificationService },
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
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── bookAppointment ──────────────────────────────────────────────────────

  describe('bookAppointment', () => {
    /** A DTO whose date is always today (required for booking window) */
    const makeTodayDto = (startTime: string, endTime: string) => ({
      doctorId: 1,
      date: todayStr(),
      startTime,
      endTime,
    });
    beforeEach(() => {
      jest.useFakeTimers();
      // Set system time to 8:00 AM local time on Friday, June 24, 2050
      jest.setSystemTime(new Date(2050, 5, 24, 8, 0, 0));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should successfully book an appointment for today and create a notification', async () => {
      const patientUserId = 1;
      const dto = {
        doctorId: 2,
        date: '2050-06-24', // Today
        startTime: '10:00',
        endTime: '10:30',
      };

    // ── Day 19: Booking window tests ────────────────────────────────────

    it('[Day 19] should reject booking when current time is BEFORE the booking window opens', async () => {
      const availHours = buildAvailHoursForBeforeWindow();
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        fullName: 'Dr. Test',
        isAvailable: true,
        availabilityHours: availHours,
        schedulingType: 'STREAM',
      });
      mockPatientRepo.findOne.mockResolvedValue({ id: 2, userId: 10 });

      // Use a future time within "consultation hours" for the slot itself
      const futureTime = `${String(new Date().getHours() + 4).padStart(2, '0')}:00`;
      const futureEndTime = `${String(new Date().getHours() + 5).padStart(2, '0')}:00`;
      const dto = makeTodayDto(futureTime, futureEndTime);

      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        /Booking window is not open yet/,
      );
    });

    it('[Day 19] should reject booking when current time is AFTER the booking window closes', async () => {
      const availHours = buildAvailHoursForAfterWindow();
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        fullName: 'Dr. Test',
        isAvailable: true,
        availabilityHours: availHours,
        schedulingType: 'STREAM',
      });
      mockPatientRepo.findOne.mockResolvedValue({ id: 2, userId: 10 });

      const now = new Date();
      const slotStart = `${String(now.getHours()).padStart(2, '0')}:30`;
      const slotEnd   = `${String(now.getHours() + 1).padStart(2, '0')}:00`;
      const dto = makeTodayDto(slotStart, slotEnd);

      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        /Booking window has closed/,
      );
      const result = await service.bookAppointment(patientUserId, dto);

      expect(result.message).toBe('Appointment booked successfully');
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
        patientId: 3,
        type: NotificationType.APPOINTMENT_BOOKED,
        title: 'Appointment Booked',
        message: expect.stringContaining('Your appointment with Dr. John Doe has been booked successfully for 24 June at 10:00.')
      }));
    });

    it('should throw BadRequestException when booking for a past date', async () => {
      const patientUserId = 1;
      const dto = {
        doctorId: 2,
        date: '2050-06-23', // Past date
        startTime: '10:00',
        endTime: '10:30',
      };

      doctorRepo.findOne.mockResolvedValue({ id: 2, fullName: 'John Doe' });
      patientRepo.findOne.mockResolvedValue({ id: 3, userId: patientUserId });

      await expect(service.bookAppointment(patientUserId, dto))
        .rejects
        .toThrow(new BadRequestException('Booking for past dates is not allowed. Please book for today.'));
    });

    it('should throw BadRequestException when booking for a future date', async () => {
      const patientUserId = 1;
      const dto = {
        doctorId: 2,
        date: '2050-06-25', // Future date
        startTime: '10:00',
        endTime: '10:30',
      };

      doctorRepo.findOne.mockResolvedValue({ id: 2, fullName: 'John Doe' });
      patientRepo.findOne.mockResolvedValue({ id: 3, userId: patientUserId });

      await expect(service.bookAppointment(patientUserId, dto))
        .rejects
        .toThrow(new BadRequestException('Booking for future dates is not allowed. Appointments can only be booked for today.'));
    });

    it('[Day 19] should allow booking when current time is WITHIN the booking window', async () => {
      const availHours = buildAvailHoursForOpenWindow();
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        fullName: 'Dr. Open',
        isAvailable: true,
        availabilityHours: availHours,
        schedulingType: 'STREAM',
        slotDuration: 30,
        bufferTime: 0,
      });
      mockPatientRepo.findOne.mockResolvedValue({ id: 2, userId: 10 });
      mockAppointmentRepo.findOne.mockResolvedValue(null); // no conflict

      // Pick a slot 1 hour from now — clamped to stay before 23:00
      const now = new Date();
      const slotH = Math.min(now.getHours() + 1, 21); // cap at 21 so slot ends at 21:30 ≤ 22:00
      const slotStart = `${String(slotH).padStart(2, '0')}:00`;
      const slotEnd   = `${String(slotH).padStart(2, '0')}:30`;
      const dto = makeTodayDto(slotStart, slotEnd);

      const result = await service.bookAppointment(10, dto);
      expect(result.message).toBe('Appointment booked successfully');
      expect(mockAppointmentRepo.save).toHaveBeenCalled();
    });

    // ── Day 16: Today-only validation ───────────────────────────────────

    it('[Day 16] should reject booking for a future date (not today)', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        fullName: 'Dr. Tomorrow',
        isAvailable: true,
        availabilityHours: 'Mon-Sun 09:00am-05:00pm',
        schedulingType: 'STREAM',
      });
      mockPatientRepo.findOne.mockResolvedValue({ id: 2, userId: 10 });

      const dto = {
        doctorId: 1,
        date: tomorrowStr(), // ← NOT today
        startTime: '10:00',
        endTime: '10:30',
      };

      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        /only be booked for today/,
      );

      expect(result.message).toBe('Appointment updated successfully');
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
        patientId: 3,
        type: NotificationType.APPOINTMENT_RESCHEDULED,
        title: 'Appointment Rescheduled',
        message: expect.stringContaining('Your appointment has been rescheduled to 27 June at 14:30.')
      }));
    });

    it('[Day 16] should reject booking for a past date', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: true,
        availabilityHours: 'Mon-Sun 09:00am-05:00pm',
        schedulingType: 'STREAM',
      });
      mockPatientRepo.findOne.mockResolvedValue({ id: 2, userId: 10 });

      const dto = {
        doctorId: 1,
        date: '2020-01-01', // ← past date
        startTime: '10:00',
        endTime: '10:30',
      };

      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        BadRequestException,
      );
      appointmentRepo.findOne.mockResolvedValue(mockAppointment);
      patientRepo.findOne.mockResolvedValue({ id: 3, userId: patientUserId });

      const result = await service.cancelAppointment(
        appointmentId,
        patientUserId,
      );

      expect(result.message).toBe('Appointment cancelled successfully');
      expect(mockAppointment.status).toBe(AppointmentStatus.CANCELLED);
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
        patientId: 3,
        type: NotificationType.APPOINTMENT_CANCELLED,
        title: 'Appointment Cancelled',
        message: expect.stringContaining('Your appointment scheduled on 24 June at 10:00 has been cancelled.')
      }));
    });

    // ── Edge Cases ───────────────────────────────────────────────────────

    it('should throw NotFoundException when doctor is not found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.bookAppointment(10, { doctorId: 999, date: todayStr(), startTime: '10:00', endTime: '10:30' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when patient profile is not found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: true,
        availabilityHours: 'Mon-Sun 09:00am-05:00pm',
        schedulingType: 'STREAM',
      });
      mockPatientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.bookAppointment(10, { doctorId: 1, date: todayStr(), startTime: '10:00', endTime: '10:30' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid date format', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: true,
        availabilityHours: 'Mon-Sun 09:00am-05:00pm',
      });
      mockPatientRepo.findOne.mockResolvedValue({ id: 2, userId: 10 });

      const dto = { doctorId: 1, date: '30-06-2026', startTime: '10:00', endTime: '10:30' };
      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when doctor is unavailable (isAvailable=false)', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: false,  // ← doctor not accepting appointments
        availabilityHours: buildAvailHoursForOpenWindow(),
        schedulingType: 'STREAM',
      });
      mockPatientRepo.findOne.mockResolvedValue({ id: 2, userId: 10 });

      const dto = makeTodayDto('10:00', '10:30');
      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.bookAppointment(10, dto)).rejects.toThrow(
        /not available/,
      );
    });
  });

  // ─── getDoctorAppointments ────────────────────────────────────────────────

  describe('getDoctorAppointments', () => {
    const mockDoctor = { id: 1, userId: 101, isAvailable: true, availabilityHours: 'Mon-Fri 09:00am-05:00pm', schedulingType: 'STREAM' };

    it('should throw NotFoundException when doctor profile is not found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(null);
      await expect(service.getDoctorAppointments(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return appointments excluding cancelled ones', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.find.mockResolvedValue([
        {
          id: 1,
          date: todayStr(),
          startTime: '10:00',
          endTime: '10:30',
          status: AppointmentStatus.BOOKED,
          patient: { id: 1, fullName: 'Alice', age: 30, gender: 'FEMALE', contactDetails: '999' },
        },
        {
          id: 2,
          date: todayStr(),
          startTime: '11:00',
          endTime: '11:30',
          status: AppointmentStatus.CANCELLED, // ← should be filtered out
          patient: { id: 2, fullName: 'Bob', age: 25, gender: 'MALE', contactDetails: '888' },
        },
      ]);

      const result = await service.getDoctorAppointments(101);
      expect(result.message).toBe('Appointments fetched successfully');
      expect(result.appointments).toHaveLength(1);
      expect(result.appointments[0].id).toBe(1);
      expect(result.appointments[0].schedulingType).toBe('STREAM');
    });

    it('should support filtering appointments by date', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.find.mockResolvedValue([]);
  describe('cancelAppointmentByDoctor', () => {
    it('should throw NotFoundException if doctor does not exist', async () => {
      doctorRepo.findOne.mockResolvedValue(null);
      await expect(
        service.cancelAppointmentByDoctor(1, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully cancel appointment as a doctor and create notification', async () => {
      doctorRepo.findOne.mockResolvedValue({ id: 2, userId: 1, fullName: 'Dr. Smith' });
      const mockAppointment = {
        id: 1,
        doctorId: 2,
        patientId: 3,
        date: '2026-06-25',
        startTime: '10:00',
        status: AppointmentStatus.BOOKED,
        patient: { id: 3 },
      };

      await service.getDoctorAppointments(101, todayStr());

      expect(mockAppointmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ date: todayStr() }),
        }),
      );
    });

    it('should throw BadRequestException for invalid date filter format', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      await expect(service.getDoctorAppointments(101, 'invalid-date')).rejects.toThrow(
        BadRequestException,
      );
    });
      const result = await service.cancelAppointmentByDoctor(1, 1);
      expect(result.message).toBe('Appointment cancelled successfully');
      expect(mockAppointment.status).toBe(AppointmentStatus.CANCELLED);
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
        patientId: 3,
        type: NotificationType.APPOINTMENT_CANCELLED,
        title: 'Appointment Cancelled',
        message: expect.stringContaining('has been cancelled by Dr. Dr. Smith')
      }));
    });

    it('should throw ForbiddenException if appointment belongs to another doctor', async () => {
      doctorRepo.findOne.mockResolvedValue({ id: 2, userId: 1 });
      const mockAppointment = {
        id: 1,
        doctorId: 3, // Different doctor ID
        patientId: 3,
        status: AppointmentStatus.BOOKED,
      };

      appointmentRepo.findOne.mockResolvedValue(mockAppointment);
      await expect(
        service.cancelAppointmentByDoctor(1, 1),
      ).rejects.toThrow(ForbiddenException);
    });
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockDoctor = { id: 1, userId: 101, isAvailable: true, availabilityHours: 'Mon-Fri 09:00am-05:00pm' };
  const mockPatient = { id: 1, userId: 201, fullName: 'John Doe', age: 30, gender: Gender.MALE, contactDetails: '123' };
  
  const mockAppointment = {
    id: 1,
    doctorId: 1,
    patientId: 1,
    date: '2026-06-25',
    startTime: '10:00',
    endTime: '10:30',
    status: AppointmentStatus.CONFIRMED,
    patient: mockPatient,
    doctor: mockDoctor,
  };

    it('should return proper message when no appointments found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.find.mockResolvedValue([]);

      const result = await service.getDoctorAppointments(101);
      expect(result.message).toBe('No appointments found.');
      expect(result.appointments).toEqual([]);

      expect(mockDoctorRepo.findOne).toHaveBeenCalledWith({ where: { userId: 101 } });
      expect(mockAppointmentRepo.find).toHaveBeenCalledWith({
        where: { doctorId: 1 },
        relations: { patient: true },
        order: { date: 'ASC', startTime: 'ASC' },
      });
      expect(result.appointments).toHaveLength(1);
      expect(result.appointments[0].schedulingType).toBe('STREAM');
    });
  });

  // ─── cancelAppointmentByDoctor ────────────────────────────────────────────

  describe('cancelAppointmentByDoctor', () => {
    const mockDoctor = { id: 1, userId: 101, fullName: 'Dr. Smith' };
    const mockAppointment = {
      id: 1,
      doctorId: 1,
      patientId: 5,
      date: tomorrowStr(),
      startTime: '10:00',
      status: AppointmentStatus.BOOKED,
      patient: { id: 5 },
    };

    it('should cancel appointment and update status to CANCELLED', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.findOne.mockResolvedValue({ ...mockAppointment });
      mockAppointmentRepo.save.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      expect(mockAppointmentRepo.find).toHaveBeenCalledWith({
        where: { doctorId: 1, date: '2026-06-25' },
        relations: { patient: true },
        order: { date: 'ASC', startTime: 'ASC' },
      });

      const result = await service.cancelAppointmentByDoctor(1, 101);
      expect(result.message).toBe('Appointment cancelled successfully');
      expect(mockAppointmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AppointmentStatus.CANCELLED }),
      );
    });

    it('should throw NotFoundException when appointment is not found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelAppointmentByDoctor(999, 101)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when doctor profile is not found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelAppointmentByDoctor(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when appointment belongs to a different doctor', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({ ...mockDoctor, id: 2 }); // different ID
      mockAppointmentRepo.findOne.mockResolvedValue({ ...mockAppointment }); // doctorId = 1

      await expect(service.cancelAppointmentByDoctor(1, 101)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if appointment is already cancelled', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      await expect(service.cancelAppointmentByDoctor(1, 101)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── cancelAppointment (patient) ─────────────────────────────────────────

  describe('cancelAppointment (patient)', () => {
    const mockPatient = { id: 5, userId: 10 };
    const mockAppointment = {
      id: 1,
      doctorId: 1,
      patientId: 5,
      date: tomorrowStr(), // well in the future — no 30-min guard triggers
      startTime: '10:00',
      endTime: '10:30',
      status: AppointmentStatus.BOOKED,
    };

    it('should cancel the appointment successfully', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...mockAppointment });
      mockPatientRepo.findOne.mockResolvedValue(mockPatient);
      mockAppointmentRepo.save.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      const result = await service.cancelAppointment(1, 10);
      expect(mockAppointmentRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, relations: { patient: true } });
      expect(mockDoctorRepo.findOne).toHaveBeenCalledWith({ where: { userId: 101 } });
      expect(mockAppointmentRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        status: AppointmentStatus.CANCELLED
      }));
      expect(result.message).toBe('Appointment cancelled successfully');
    });

    it('should throw NotFoundException when appointment does not exist', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelAppointment(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when patient does not own the appointment', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...mockAppointment });
      mockPatientRepo.findOne.mockResolvedValue({ id: 99, userId: 10 }); // different patient

      await expect(service.cancelAppointment(1, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if appointment is already cancelled', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });
      mockPatientRepo.findOne.mockResolvedValue(mockPatient);

      await expect(service.cancelAppointment(1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── getNextAvailableSlots ────────────────────────────────────────────────

  describe('getNextAvailableSlots', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.getNextAvailableSlots(1, '2026/06/30')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when doctor does not exist', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(null);
      await expect(service.getNextAvailableSlots(1, todayStr())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return unavailability message when doctor.isAvailable is false', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: false,
      });

      const result = await service.getNextAvailableSlots(1, todayStr());
      expect(result.message).toBe(
        'Doctor is currently not available for new appointments.',
      );
      expect(result.slots).toEqual([]);
    });

    it('should return available slots when found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: true,
        availabilityHours: 'Mon-Sun 09:00am-05:00pm',
        schedulingType: 'STREAM',
        slotDuration: 30,
        bufferTime: 0,
      });

      jest.spyOn(service, 'getAvailableSlots').mockResolvedValue({
        message: 'Available slots fetched successfully',
        date: todayStr(),
        slots: [{ startTime: '10:00', endTime: '10:30' }],
      });

      const result = await service.getNextAvailableSlots(1, todayStr());
      expect(result.slots.length).toBeGreaterThan(0);
    });
  });
});
});
