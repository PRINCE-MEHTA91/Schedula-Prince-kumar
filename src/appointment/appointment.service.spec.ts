import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentService } from './appointment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/enums/notification-type.enum';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let appointmentRepo: any;
  let doctorRepo: any;
  let patientRepo: any;
  let notificationService: any;

  // ─── Shared fixtures ────────────────────────────────────────────────────────
  const mockDoctor = {
    id: 1,
    userId: 101,
    isAvailable: true,
    allowFutureBooking: true,
    maxFutureBookingDays: null,
    availabilityHours: 'Mon-Fri 09:00am-05:00pm',
    schedulingType: 'STREAM',
    fullName: 'Dr. Smith',
  };

  const mockPatient = {
    id: 1,
    userId: 201,
    fullName: 'John Doe',
    age: 30,
    contactDetails: '123',
  };

  const mockAppointment = {
    id: 1,
    doctorId: 1,
    patientId: 1,
    date: '2050-06-24',
    startTime: '10:00',
    endTime: '10:30',
    status: AppointmentStatus.CONFIRMED,
    patient: mockPatient,
    doctor: mockDoctor,
  };

  // ─── Module setup ──────────────────────────────────────────────────────────
  beforeEach(async () => {
    const mockAppointmentRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((a) => Promise.resolve({ id: 1, ...a })),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockDoctorRepo = { findOne: jest.fn() };
    const mockPatientRepo = { findOne: jest.fn() };
    const mockStreamSlotRepo = { findOne: jest.fn(), save: jest.fn() };
    const mockWaveScheduleRepo = { findOne: jest.fn(), save: jest.fn() };
    const mockRecurringAvailRepo = { find: jest.fn().mockResolvedValue([]) };
    const mockCustomAvailRepo = { find: jest.fn().mockResolvedValue([]) };
    const mockNotificationService = { createNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment),          useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(DoctorProfile),        useValue: mockDoctorRepo },
        { provide: getRepositoryToken(PatientProfile),       useValue: mockPatientRepo },
        { provide: getRepositoryToken(StreamSlot),           useValue: mockStreamSlotRepo },
        { provide: getRepositoryToken(WaveSchedule),         useValue: mockWaveScheduleRepo },
        { provide: getRepositoryToken(RecurringAvailability),useValue: mockRecurringAvailRepo },
        { provide: getRepositoryToken(CustomAvailability),   useValue: mockCustomAvailRepo },
        { provide: NotificationService,                      useValue: mockNotificationService },
      ],
    }).compile();

    service             = module.get<AppointmentService>(AppointmentService);
    appointmentRepo     = module.get(getRepositoryToken(Appointment));
    doctorRepo          = module.get(getRepositoryToken(DoctorProfile));
    patientRepo         = module.get(getRepositoryToken(PatientProfile));
    notificationService = module.get(NotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getDoctorAppointments ──────────────────────────────────────────────────
  describe('getDoctorAppointments', () => {
    it('should throw NotFoundException if doctor profile is not found', async () => {
      doctorRepo.findOne.mockResolvedValue(null);
      await expect(service.getDoctorAppointments(999)).rejects.toThrow(NotFoundException);
    });

    it('should return appointments excluding cancelled ones', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor });
      appointmentRepo.find.mockResolvedValue([
        { ...mockAppointment, id: 1, status: AppointmentStatus.CONFIRMED, patient: mockPatient },
        { ...mockAppointment, id: 2, status: AppointmentStatus.CANCELLED, patient: mockPatient },
      ]);

      const result = await service.getDoctorAppointments(101);
      expect(result.message).toBe('Appointments fetched successfully');
      expect(result.appointments.length).toBe(1);
      expect(result.appointments[0].id).toBe(1);
    });

    it('should return "No appointments found." when list is empty', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor });
      appointmentRepo.find.mockResolvedValue([]);
      const result = await service.getDoctorAppointments(101);
      expect(result.message).toBe('No appointments found.');
      expect(result.appointments).toEqual([]);
    });

    it('should throw BadRequestException for invalid date filter', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor });
      await expect(service.getDoctorAppointments(101, 'invalid-date')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelAppointment (patient) ────────────────────────────────────────────
  describe('cancelAppointment', () => {
    it('should successfully cancel and create notification', async () => {
      const futureMock = {
        ...mockAppointment,
        date: '2050-06-24',
        startTime: '10:00',
        status: AppointmentStatus.CONFIRMED,
      };
      appointmentRepo.findOne.mockResolvedValue(futureMock);
      patientRepo.findOne.mockResolvedValue(mockPatient);

      const result = await service.cancelAppointment(1, 201);
      expect(result.message).toBe('Appointment cancelled successfully');
      expect(futureMock.status).toBe(AppointmentStatus.CANCELLED);
      expect(appointmentRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if appointment not found', async () => {
      appointmentRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelAppointment(999, 201)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if patient not found', async () => {
      appointmentRepo.findOne.mockResolvedValue({ ...mockAppointment });
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelAppointment(1, 201)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if patient does not own the appointment', async () => {
      appointmentRepo.findOne.mockResolvedValue({ ...mockAppointment, patientId: 99 });
      patientRepo.findOne.mockResolvedValue({ ...mockPatient, id: 1 });
      await expect(service.cancelAppointment(1, 201)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if already cancelled', async () => {
      appointmentRepo.findOne.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CANCELLED });
      patientRepo.findOne.mockResolvedValue(mockPatient);
      await expect(service.cancelAppointment(1, 201)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelAppointmentByDoctor ──────────────────────────────────────────────
  describe('cancelAppointmentByDoctor', () => {
    it('should throw NotFoundException if doctor not found', async () => {
      doctorRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelAppointmentByDoctor(1, 101)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if appointment not found', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor });
      appointmentRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelAppointmentByDoctor(999, 101)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unauthorized doctor', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor, id: 2, userId: 102 });
      appointmentRepo.findOne.mockResolvedValue({ ...mockAppointment, doctorId: 1, patient: mockPatient });
      await expect(service.cancelAppointmentByDoctor(1, 102)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if already cancelled', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor });
      appointmentRepo.findOne.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CANCELLED, patient: mockPatient });
      await expect(service.cancelAppointmentByDoctor(1, 101)).rejects.toThrow(BadRequestException);
    });

    it('should successfully cancel and return result', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor });
      const appt = { ...mockAppointment, patient: mockPatient };
      appointmentRepo.findOne.mockResolvedValue(appt);
      appointmentRepo.save.mockResolvedValue({ ...appt, status: AppointmentStatus.CANCELLED });

      const result = await service.cancelAppointmentByDoctor(1, 101);
      expect(result.message).toBe('Appointment cancelled successfully');
      expect(appt.status).toBe(AppointmentStatus.CANCELLED);
      expect(appointmentRepo.save).toHaveBeenCalled();
    });
  });

  // ─── getNextAvailableSlots ──────────────────────────────────────────────────
  describe('getNextAvailableSlots', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.getNextAvailableSlots(1, '2050/06/25')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if doctor not found', async () => {
      doctorRepo.findOne.mockResolvedValue(null);
      await expect(service.getNextAvailableSlots(1, '2050-06-25')).rejects.toThrow(NotFoundException);
    });

    it('should return empty when doctor not available', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor, isAvailable: false });
      const result = await service.getNextAvailableSlots(1, '2050-06-25');
      expect(result.message).toBe('Doctor is currently not available for new appointments.');
      expect(result.slots).toEqual([]);
    });

    it('should return no-appointments message when no slots in 30 days', async () => {
      doctorRepo.findOne.mockResolvedValue({ ...mockDoctor, isAvailable: true });
      jest.spyOn(service, 'getAvailableSlots').mockResolvedValue({
        message: 'Available slots fetched successfully',
        date: 'any',
        slots: [],
      });
      const result = await service.getNextAvailableSlots(1, '2050-06-24');
      expect(result.message).toBe('No appointments available in the next 30 working days. Please try again later.');
      expect(result.date).toBeNull();
    });
  });
});
