import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { Appointment } from '../patient/entities/appointment.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AvailabilityService', () => {
  let service: AvailabilityService;

  const mockDoctorProfileRepo = {
    findOne: jest.fn(),
  };
  const mockRecurringRepo = {
    find: jest.fn(),
  };
  const mockCustomRepo = {
    find: jest.fn(),
  };
  const mockAppointmentRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: getRepositoryToken(DoctorProfile),
          useValue: mockDoctorProfileRepo,
        },
        {
          provide: getRepositoryToken(RecurringAvailability),
          useValue: mockRecurringRepo,
        },
        {
          provide: getRepositoryToken(CustomAvailability),
          useValue: mockCustomRepo,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepo,
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAvailableSlots', () => {
    const doctorId = 1;

    it('should throw NotFoundException if doctor does not exist', async () => {
      mockDoctorProfileRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getAvailableSlots(doctorId, '2026-06-20'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for past dates', async () => {
      mockDoctorProfileRepo.findOne.mockResolvedValue({
        id: 1,
        slotDuration: 15,
      });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastDate = yesterday.toISOString().split('T')[0];

      await expect(
        service.getAvailableSlots(doctorId, pastDate),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return slots from recurring availability', async () => {
      mockDoctorProfileRepo.findOne.mockResolvedValue({
        id: 1,
        slotDuration: 15,
      });
      mockCustomRepo.find.mockResolvedValue([]);
      mockRecurringRepo.find.mockResolvedValue([
        { startTime: '10:00:00', endTime: '11:00:00' },
      ]);
      mockAppointmentRepo.find.mockResolvedValue([]);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = await service.getAvailableSlots(doctorId, dateStr);
      expect(result.slots.length).toBe(4);
      expect(result.slots[0].startTime).toBe('10:00');
      expect(result.slots[3].startTime).toBe('10:45');
    });

    it('should prioritize custom availability over recurring', async () => {
      mockDoctorProfileRepo.findOne.mockResolvedValue({
        id: 1,
        slotDuration: 15,
      });
      mockCustomRepo.find.mockResolvedValue([
        { startTime: '14:00:00', endTime: '14:30:00', isAvailable: true },
      ]);
      // Should not be called or used
      mockRecurringRepo.find.mockResolvedValue([
        { startTime: '10:00:00', endTime: '11:00:00' },
      ]);
      mockAppointmentRepo.find.mockResolvedValue([]);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = await service.getAvailableSlots(doctorId, dateStr);
      expect(result.slots.length).toBe(2);
      expect(result.slots[0].startTime).toBe('14:00');
      expect(result.slots[1].startTime).toBe('14:15');
      expect(mockRecurringRepo.find).not.toHaveBeenCalled();
    });

    it('should filter out booked slots', async () => {
      mockDoctorProfileRepo.findOne.mockResolvedValue({
        id: 1,
        slotDuration: 15,
      });
      mockCustomRepo.find.mockResolvedValue([]);
      mockRecurringRepo.find.mockResolvedValue([
        { startTime: '10:00:00', endTime: '11:00:00' },
      ]);
      mockAppointmentRepo.find.mockResolvedValue([
        { startTime: '10:15:00', endTime: '10:30:00' }, // Books 10:15 slot
      ]);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = await service.getAvailableSlots(doctorId, dateStr);
      expect(result.slots.length).toBe(3);
      expect(result.slots[0].startTime).toBe('10:00');
      expect(result.slots[1].startTime).toBe('10:30');
      expect(result.slots[2].startTime).toBe('10:45');
    });
  });
});
