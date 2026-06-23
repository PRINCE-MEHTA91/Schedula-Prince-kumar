import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppointmentService } from './appointment.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile, Gender } from '../patient/entities/patient-profile.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
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
        { provide: getRepositoryToken(StreamSlot), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(WaveSchedule), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(RecurringAvailability), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(CustomAvailability), useValue: { find: jest.fn() } },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
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
