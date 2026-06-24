/**
 * Unit Tests: DoctorService — Discovery APIs
 *
 * Yeh tests GET /doctor (findAll) aur GET /doctor/:id (findById) ko cover karte hain.
 * Hum Jest mocks use karte hain — real DB ki zaroorat nahi hoti.
 *
 * Test groups:
 *  1. findAll — basic doctor listing
 *  2. findAll — specialization filter
 *  3. findAll — naam se search
 *  4. findAll — pagination
 *  5. findAll — availability filter (bonus)
 *  6. findAll — empty results
 *  7. findById — success case
 *  8. findById — invalid / not found
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ILike } from 'typeorm';
import { DoctorService } from './doctor.service';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: ek fake doctor object banao (sirf discovery fields ke saath)
// ─────────────────────────────────────────────────────────────────────────────
function makeDoctor(overrides: Partial<DoctorProfile> = {}): DoctorProfile {
  return {
    id: 1,
    fullName: 'Dr. Rahul Sharma',
    specialization: 'Cardiologist',
    experience: 10,
    qualification: 'MBBS, MD',
    consultationFee: 500,
    availabilityHours: '9am - 5pm',
    isAvailable: true,
    slotDuration: 15,
    profileDetails: 'Heart diseases specialist',
    userId: 1,
    recurringAvailabilities: [],
    customAvailabilities: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null as any,
    recurringAvailabilities: [],
    customAvailabilities: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock repository — real TypeORM repo ki jagah fake functions use karo
// ─────────────────────────────────────────────────────────────────────────────
const mockRepo = {
  findAndCount: jest.fn(), // list fetch ke liye
  findOne: jest.fn(),      // single record fetch ke liye
  create: jest.fn(),       // doosre methods ke liye zaroori
  save: jest.fn(),
};

describe('DoctorService — Discovery APIs', () => {
  let service: DoctorService;

  // Har test se pehle fresh testing module setup karo
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorService,
        {
          // Real TypeORM repo ki jagah mock use karo
          provide: getRepositoryToken(DoctorProfile),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<DoctorService>(DoctorService);
  });

  // Har test ke baad mock calls reset karo taaki tests ek doosre ko affect na karein
  afterEach(() => {
    jest.clearAllMocks();
  });


  // 1. BASIC LISTING — bina kisi filter ke doctors ki list

  describe('findAll — basic doctor listing', () => {
    it('should return doctors list with pagination info', async () => {
      const fakeDoctors = [
        makeDoctor({ id: 1, fullName: 'Dr. Anil Kumar' }),
        makeDoctor({ id: 2, fullName: 'Dr. Rahul Sharma' }),
      ];

      // DB se 2 doctors aur total count = 2 simulate karo
      mockRepo.findAndCount.mockResolvedValue([fakeDoctors, 2]);

      const query: GetDoctorsQueryDto = { page: 1, limit: 10 };
      const result = await service.findAll(query);

      // Dono doctors aane chahiye
      expect(result.doctors).toHaveLength(2);
      expect(result.doctors[0].fullName).toBe('Dr. Anil Kumar');

      // Pagination metadata sahi honi chahiye
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(1);

      expect(result.message).toBe('Doctors fetched successfully');
    });

    it('should call findAndCount with empty where when no filters given', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      // Koi filter nahi hai toh where empty hona chahiye
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should use default page=1 and limit=10 when not provided', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SPECIALIZATION FILTER
  // ───────────────────────────────────────────────────────────────────────────
  describe('findAll — specialization filter', () => {
    it('should filter by specialization using ILike (case-insensitive)', async () => {
      const cardiologist = makeDoctor({ specialization: 'Cardiologist' });
      mockRepo.findAndCount.mockResolvedValue([[cardiologist], 1]);

      const query: GetDoctorsQueryDto = { specialization: 'cardiologist' };
      const result = await service.findAll(query);

      // ILike se case-insensitive partial match hona chahiye
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { specialization: ILike('%cardiologist%') },
        }),
      );

      expect(result.doctors).toHaveLength(1);
      expect(result.doctors[0].specialization).toBe('Cardiologist');
    });

    it('should return empty result when specialization nahi milti', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const query: GetDoctorsQueryDto = { specialization: 'xyz-unknown' };
      const result = await service.findAll(query);

      expect(result.doctors).toHaveLength(0);
      // Empty message mein specialization naam hona chahiye
      expect(result.message).toContain('xyz-unknown');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. NAAM SE SEARCH
  // ───────────────────────────────────────────────────────────────────────────
  describe('findAll — naam se search', () => {
    it('should search by partial name using ILike', async () => {
      const rahul = makeDoctor({ fullName: 'Dr. Rahul Sharma' });
      mockRepo.findAndCount.mockResolvedValue([[rahul], 1]);

      const query: GetDoctorsQueryDto = { search: 'rahul' };
      const result = await service.findAll(query);

      // ILike se partial naam match hona chahiye
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fullName: ILike('%rahul%') },
        }),
      );

      expect(result.doctors[0].fullName).toBe('Dr. Rahul Sharma');
    });

    it('should return empty result when naam match nahi hota', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const query: GetDoctorsQueryDto = { search: 'zzznobodynamedthis' };
      const result = await service.findAll(query);

      expect(result.doctors).toHaveLength(0);
      // Empty message mein search term hona chahiye
      expect(result.message).toContain('zzznobodynamedthis');
    });

    it('should find doctor with partial match — "rah" matches "Rahul"', async () => {
      const rahul = makeDoctor({ fullName: 'Dr. Rahul Gupta' });
      mockRepo.findAndCount.mockResolvedValue([[rahul], 1]);

      const result = await service.findAll({ search: 'rah' });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fullName: ILike('%rah%') },
        }),
      );
      expect(result.doctors).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. PAGINATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('findAll — pagination', () => {
    it('should calculate correct skip for page 2, limit 5', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 2, limit: 5 });

      // skip = (2-1) * 5 = 5 → records 6-10 dikhenge
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('should return correct totalPages when total evenly divisible hai', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 20]);

      const result = await service.findAll({ page: 1, limit: 10 });

      // 20 / 10 = 2 pages
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should round up totalPages when total evenly divisible nahi hai', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 21]);

      const result = await service.findAll({ page: 1, limit: 10 });

      // 21 / 10 = 2.1 → ceil → 3 pages
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return totalPages=0 when koi doctors nahi hain', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 10 });

      // Math.ceil(0/10) = 0
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should return correct page and limit in pagination metadata', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 100]);

      const result = await service.findAll({ page: 3, limit: 15 });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(15);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. AVAILABILITY FILTER (Bonus)
  // ───────────────────────────────────────────────────────────────────────────
  describe('findAll — availability filter', () => {
    it('should filter sirf available doctors when availability=true', async () => {
      const available = makeDoctor({ isAvailable: true });
      mockRepo.findAndCount.mockResolvedValue([[available], 1]);

      await service.findAll({ availability: true });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isAvailable: true } }),
      );
    });

    it('should filter sirf unavailable doctors when availability=false', async () => {
      const unavailable = makeDoctor({ isAvailable: false });
      mockRepo.findAndCount.mockResolvedValue([[unavailable], 1]);

      await service.findAll({ availability: false });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isAvailable: false } }),
      );
    });

    it('should NOT apply availability filter jab param nahi diya', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      // where empty hona chahiye — isAvailable filter nahi lagna chahiye
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. EMPTY RESULTS — helpful messages
  // ───────────────────────────────────────────────────────────────────────────
  describe('findAll — empty results', () => {
    it('should return generic message when koi bhi doctor registered nahi', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.doctors).toEqual([]);
      expect(result.message).toBe('No doctors are registered on the platform yet.');
    });

    it('should mention search term in message when naam search empty aaye', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ search: 'nobody' });

      // Message mein search term hona chahiye
      expect(result.message).toContain('"nobody"');
    });

    it('should mention specialization in message when filter empty aaye', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ specialization: 'neurologist' });

      expect(result.message).toContain('"neurologist"');
    });

    it('should return specific message when koi available doctor nahi mila', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ availability: true });

      expect(result.message).toBe('No available doctors found at the moment.');
    });

    it('should resolve normally (throw nahi karna) jab result empty ho', async () => {
      // Empty results valid hain — NotFoundException nahi aani chahiye
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await expect(service.findAll({ search: 'nobody' })).resolves.toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. FIND BY ID — success case
  // ───────────────────────────────────────────────────────────────────────────
  describe('findById — success', () => {
    it('should return full doctor profile when valid ID diya', async () => {
      const doctor = makeDoctor({ id: 5, fullName: 'Dr. Priya Patel' });
      mockRepo.findOne.mockResolvedValue(doctor);

      const result = await service.findById(5);

      expect(result.doctor.id).toBe(5);
      expect(result.doctor.fullName).toBe('Dr. Priya Patel');
      expect(result.message).toBe('Doctor profile fetched successfully');
    });

    it('should query DB with correct ID', async () => {
      mockRepo.findOne.mockResolvedValue(makeDoctor({ id: 7 }));

      await service.findById(7);

      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 7 } }),
      );
    });

    it('should return qualification aur availabilityHours bhi (detail page)', async () => {
      const doctor = makeDoctor({
        qualification: 'MBBS, MD',
        availabilityHours: '10am - 6pm',
        profileDetails: 'Heart specialist',
      });
      mockRepo.findOne.mockResolvedValue(doctor);

      const result = await service.findById(1);

      // Detail endpoint mein extra fields bhi honi chahiye
      expect(result.doctor.qualification).toBe('MBBS, MD');
      expect(result.doctor.availabilityHours).toBe('10am - 6pm');
      expect(result.doctor.profileDetails).toBe('Heart specialist');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. FIND BY ID — invalid / not found
  // ───────────────────────────────────────────────────────────────────────────
  describe('findById — invalid inputs aur not found', () => {
    it('should throw NotFoundException jab ID exist nahi karta', async () => {
      // DB null return kare — doctor nahi mila
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('should error message mein ID include kare', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(42)).rejects.toThrow(
        'Doctor with ID 42 not found.',
      );
    });

    it('should throw NotFoundException for ID 0 jab DB null return kare', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(0)).rejects.toThrow(NotFoundException);
    });
  });
});
