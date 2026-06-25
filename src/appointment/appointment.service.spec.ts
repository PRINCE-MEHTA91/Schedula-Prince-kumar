import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentService } from './appointment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
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

  beforeEach(async () => {
    const mockAppointmentRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((appointment) =>
          Promise.resolve({ id: 1, ...appointment }),
        ),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockDoctorRepo = {
      findOne: jest.fn(),
    };

    const mockPatientRepo = {
      findOne: jest.fn(),
    };

    const mockNotificationService = {
      createNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepo,
        },
        {
          provide: getRepositoryToken(DoctorProfile),
          useValue: mockDoctorRepo,
        },
        {
          provide: getRepositoryToken(PatientProfile),
          useValue: mockPatientRepo,
        },
        { provide: NotificationService, useValue: mockNotificationService },
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppointmentService } from './appointment.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile, Gender } from '../patient/entities/patient-profile.entity';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('AppointmentService', () => {
  let service: AppointmentService;

  const mockAppointmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockDoctorRepo = {
    findOne: jest.fn(),
  };

  const mockPatientRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(DoctorProfile), useValue: mockDoctorRepo },
        { provide: getRepositoryToken(PatientProfile), useValue: mockPatientRepo },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    appointmentRepo = module.get(getRepositoryToken(Appointment));
    doctorRepo = module.get(getRepositoryToken(DoctorProfile));
    patientRepo = module.get(getRepositoryToken(PatientProfile));
    notificationService = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('bookAppointment', () => {
    it('should successfully book an appointment and create a notification', async () => {
      const patientUserId = 1;
      const dto = {
        doctorId: 2,
        date: '2050-06-25', // Future date
        startTime: '10:00',
        endTime: '10:30',
      };

      doctorRepo.findOne.mockResolvedValue({
        id: 2,
        fullName: 'John Doe',
        availabilityHours: 'Mon-Fri 09:00am-05:00pm',
      });
      patientRepo.findOne.mockResolvedValue({ id: 3, userId: patientUserId });
      appointmentRepo.findOne.mockResolvedValue(null); // No conflicting appointment

      // Ensure the mock date falls on a valid day (e.g., Monday-Friday)
      // 2050-06-25 is a Saturday, so it might fail the availability check.
      // Let's use 2050-06-24 which is a Friday.
      dto.date = '2050-06-24';

      const result = await service.bookAppointment(patientUserId, dto);

      expect(result.message).toBe('Appointment booked successfully');
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        3,
        NotificationType.APPOINTMENT_BOOKED,
        'Appointment Booked',
        expect.stringContaining(
          'Your appointment with Dr. John Doe has been booked successfully for 24 June at 10:00.',
        ),
      );
    });
  });

  describe('rescheduleAppointment', () => {
    it('should successfully reschedule and create a notification', async () => {
      const patientUserId = 1;
      const appointmentId = 1;
      const dto = {
        date: '2050-06-27', // Monday
        startTime: '14:30',
        endTime: '15:00',
      };

      const mockAppointment = {
        id: appointmentId,
        doctorId: 2,
        patientId: 3,
        date: '2050-06-24',
        startTime: '10:00',
        endTime: '10:30',
        status: AppointmentStatus.BOOKED,
        doctor: {
          id: 2,
          availabilityHours: 'Mon-Fri 09:00am-05:00pm',
        },
        patient: {
          id: 3,
          userId: patientUserId,
        },
      };

      appointmentRepo.findOne
        .mockResolvedValueOnce(mockAppointment) // First call to find appointment
        .mockResolvedValueOnce(null); // Second call to check existing slots

      const result = await service.rescheduleAppointment(
        appointmentId,
        patientUserId,
        dto,
      );

      expect(result.message).toBe('Appointment updated successfully');
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        3,
        NotificationType.APPOINTMENT_RESCHEDULED,
        'Appointment Rescheduled',
        expect.stringContaining(
          'Your appointment has been rescheduled to 27 June at 14:30.',
        ),
      );
    });
  });

  describe('cancelAppointment', () => {
    it('should successfully cancel and create a notification', async () => {
      const patientUserId = 1;
      const appointmentId = 1;

      const mockAppointment = {
        id: appointmentId,
        patientId: 3,
        date: '2050-06-24',
        startTime: '10:00',
        endTime: '10:30',
        status: AppointmentStatus.BOOKED,
      };

      appointmentRepo.findOne.mockResolvedValue(mockAppointment);
      patientRepo.findOne.mockResolvedValue({ id: 3, userId: patientUserId });

      const result = await service.cancelAppointment(
        appointmentId,
        patientUserId,
      );

      expect(result.message).toBe('Appointment cancelled successfully');
      expect(mockAppointment.status).toBe(AppointmentStatus.CANCELLED);
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        3,
        NotificationType.APPOINTMENT_CANCELLED,
        'Appointment Cancelled',
        expect.stringContaining(
          'Your appointment scheduled on 24 June at 10:00 has been cancelled.',
        ),
      );
    });
  });

  describe('getNextAvailableSlots', () => {
    it('should throw BadRequestException if date format is invalid', async () => {
      await expect(
        service.getNextAvailableSlots(1, '2050/06/25'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if doctor does not exist', async () => {
      doctorRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getNextAvailableSlots(1, '2050-06-25'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return message if doctor is not available', async () => {
      doctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: false,
      });

      const result = await service.getNextAvailableSlots(1, '2050-06-25');
      expect(result.message).toBe('Doctor is currently not available for new appointments.');
      expect(result.slots).toEqual([]);
    });

    it('should return today slots if available', async () => {
      doctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: true,
        availabilityHours: 'Mon-Fri 09:00am-05:00pm',
      });

      // Mock getAvailableSlots internally called by getNextAvailableSlots
      jest.spyOn(service, 'getAvailableSlots').mockResolvedValue({
        message: 'Available slots fetched successfully',
        date: '2050-06-24',
        slots: [{ startTime: '09:00', endTime: '09:30' }],
      });

      const result = await service.getNextAvailableSlots(1, '2050-06-24'); // Friday
      expect(result.message).toBe('Slots available today');
      expect(result.date).toBe('2050-06-24');
      expect(result.slots.length).toBeGreaterThan(0);
    });

    it('should return next day slots if today is full', async () => {
      doctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: true,
        availabilityHours: 'Mon-Fri 09:00am-05:00pm',
      });

      // First call (today) returns empty slots, second call (next day) returns slots
      jest.spyOn(service, 'getAvailableSlots')
        .mockResolvedValueOnce({ message: 'Success', date: '2050-06-24', slots: [] }) // Friday
        .mockResolvedValueOnce({ message: 'Success', date: '2050-06-27', slots: [{ startTime: '09:00', endTime: '09:30' }] }); // Monday (Saturday/Sunday skipped)

      const result = await service.getNextAvailableSlots(1, '2050-06-24'); 
      expect(result.message).toBe('Next available slots fetched successfully');
      expect(result.date).toBe('2050-06-27');
      expect(result.slots.length).toBeGreaterThan(0);
    });

    it('should return no appointments message if no slots in 30 days', async () => {
      doctorRepo.findOne.mockResolvedValue({
        id: 1,
        isAvailable: true,
        availabilityHours: 'Mon-Fri 09:00am-05:00pm',
      });

      // Always return empty slots
      jest.spyOn(service, 'getAvailableSlots').mockResolvedValue({
        message: 'Success',
        date: 'any',
        slots: [],
      });

      const result = await service.getNextAvailableSlots(1, '2050-06-24');
      expect(result.message).toBe('No appointments available in the next 30 working days. Please try again later.');
      expect(result.date).toBeNull();
      expect(result.slots).toEqual([]);
    });
  describe('getDoctorAppointments', () => {
    it('should throw NotFoundException if doctor profile is not found', async () => {
      doctorRepo.findOne.mockResolvedValue(null);
      await expect(service.getDoctorAppointments(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return appointments excluding cancelled ones and support date filter', async () => {
      doctorRepo.findOne.mockResolvedValue({ id: 2, userId: 1 });
      const mockAppointments = [
        {
          id: 1,
          date: '2026-06-25',
          status: AppointmentStatus.BOOKED,
          patient: { id: 1, fullName: 'John Doe' },
        },
        {
          id: 2,
          date: '2026-06-25',
          status: AppointmentStatus.CANCELLED,
          patient: { id: 2, fullName: 'Jane Doe' },
        },
      ];

      appointmentRepo.find.mockResolvedValue(mockAppointments);

      const result = await service.getDoctorAppointments(1, '2026-06-25');
      expect(appointmentRepo.find).toHaveBeenCalledWith({
        where: { doctorId: 2, date: '2026-06-25' },
        relations: { patient: true },
        order: { date: 'ASC', startTime: 'ASC' },
      });
      expect(result.message).toBe('Appointments fetched successfully');
      expect(result.appointments.length).toBe(1); // Only BOOKED one should be returned
      expect(result.appointments[0].id).toBe(1);
      expect(result.appointments[0].schedulingType).toBe('Stream');
    });
  });

  describe('cancelDoctorAppointment', () => {
    it('should throw NotFoundException if doctor does not exist', async () => {
      doctorRepo.findOne.mockResolvedValue(null);
      await expect(
        service.cancelDoctorAppointment(1, 1),
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

      appointmentRepo.findOne.mockResolvedValue(mockAppointment);

      const result = await service.cancelDoctorAppointment(1, 1);
      expect(result.message).toBe('Appointment cancelled successfully');
      expect(mockAppointment.status).toBe(AppointmentStatus.CANCELLED);
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        3,
        NotificationType.APPOINTMENT_CANCELLED,
        'Appointment Cancelled',
        expect.stringContaining('has been cancelled by Dr. Dr. Smith'),
      );
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
        service.cancelDoctorAppointment(1, 1),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
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

  describe('getDoctorAppointments', () => {
    it('should return appointments assigned to doctor', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.find.mockResolvedValue([mockAppointment]);

      const result = await service.getDoctorAppointments(101);

      expect(mockDoctorRepo.findOne).toHaveBeenCalledWith({ where: { userId: 101 } });
      expect(mockAppointmentRepo.find).toHaveBeenCalledWith({
        where: { doctorId: 1, status: AppointmentStatus.CONFIRMED },
        relations: { patient: true },
        order: { date: 'ASC', startTime: 'ASC' },
      });
      expect(result.appointments).toHaveLength(1);
      expect(result.appointments[0].schedulingType).toBe('STREAM');
    });

    it('should filter appointments by date', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.find.mockResolvedValue([mockAppointment]);

      await service.getDoctorAppointments(101, '2026-06-25');

      expect(mockAppointmentRepo.find).toHaveBeenCalledWith({
        where: { doctorId: 1, status: AppointmentStatus.CONFIRMED, date: '2026-06-25' },
        relations: { patient: true },
        order: { date: 'ASC', startTime: 'ASC' },
      });
    });

    it('should throw BadRequestException for invalid date filter', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      
      await expect(service.getDoctorAppointments(101, 'invalid-date')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if doctor not found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(null);
      
      await expect(service.getDoctorAppointments(999)).rejects.toThrow(NotFoundException);
    });

    it('should return proper message if no appointments found', async () => {
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.find.mockResolvedValue([]);

      const result = await service.getDoctorAppointments(101);

      expect(result.message).toBe('No appointments found.');
      expect(result.appointments).toEqual([]);
    });
  });

  describe('cancelAppointmentByDoctor', () => {
    it('should update appointment status to CANCELLED', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...mockAppointment });
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockAppointmentRepo.save.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CANCELLED });

      const result = await service.cancelAppointmentByDoctor(1, 101);

      expect(mockAppointmentRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockDoctorRepo.findOne).toHaveBeenCalledWith({ where: { userId: 101 } });
      expect(mockAppointmentRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        status: AppointmentStatus.CANCELLED
      }));
      expect(result.message).toBe('Appointment cancelled successfully');
      expect(result.appointment.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('should throw NotFoundException if appointment not found', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);
      
      await expect(service.cancelAppointmentByDoctor(999, 101)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unauthorized access (another doctor)', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(mockAppointment);
      mockDoctorRepo.findOne.mockResolvedValue({ ...mockDoctor, id: 2, userId: 102 });

      await expect(service.cancelAppointmentByDoctor(1, 102)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if appointment already cancelled', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CANCELLED });
      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);

      await expect(service.cancelAppointmentByDoctor(1, 101)).rejects.toThrow(BadRequestException);
    });
  });
});
