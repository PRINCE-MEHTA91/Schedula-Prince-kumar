import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
  ) {}

  // ─── Doctor Self-Management (DOCTOR role) ────────────────────────────────────

  async createProfile(userId: number, dto: CreateDoctorProfileDto) {
    const existing = await this.doctorProfileRepo.findOne({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException(
        'Doctor profile already exists. Use PATCH to update.',
      );
    }

    const profile = this.doctorProfileRepo.create({ ...dto, userId });
    const saved = await this.doctorProfileRepo.save(profile);

    return {
      message: 'Doctor profile created successfully',
      profile: saved,
    };
  }

  async getProfile(userId: number) {
    const profile = await this.doctorProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Doctor profile not found. Please complete onboarding first.',
      );
    }

    return {
      message: 'Doctor profile fetched successfully',
      profile,
    };
  }

  async updateProfile(userId: number, dto: UpdateDoctorProfileDto) {
    const profile = await this.doctorProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Doctor profile not found. Please create a profile first.',
      );
    }

    const updated = await this.doctorProfileRepo.save({ ...profile, ...dto });

    return {
      message: 'Doctor profile updated successfully',
      profile: updated,
    };
  }

  // ─── Doctor Discovery (any authenticated user) ───────────────────────────────

  /**
   * GET /doctor
   * Fetch doctors list with optional filters:
   *   ?specialization=cardiologist  — case-insensitive partial match
   *   ?search=rahul                 — partial name match
   *   ?page=1&limit=10              — pagination
   *   ?availability=true            — filter by isAvailable
   */
  async findAll(query: GetDoctorsQueryDto) {
    const { specialization, search, availability } = query;

    // Pagination — defaults applied by DTO, but guard against edge cases here
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100); // hard cap at 100
    const skip = (page - 1) * limit;

    // ── Build where clause ─────────────────────────────────────────────────────

    const where: Record<string, any> = {};

    if (specialization && specialization.trim() !== '') {
      where.specialization = ILike(`%${specialization.trim()}%`);
    }

    if (search && search.trim() !== '') {
      where.fullName = ILike(`%${search.trim()}%`);
    }

    if (availability !== undefined) {
      where.isAvailable = availability;
    }

    // ── Query ──────────────────────────────────────────────────────────────────
    const [doctors, total] = await this.doctorProfileRepo.findAndCount({
      where,
      select: {
        id: true,
        fullName: true,
        specialization: true,
        experience: true,
        consultationFee: true,
        isAvailable: true,
        availabilityHours: true,
      },
      skip,
      take: limit,
      order: { fullName: 'ASC' },
    });

    // ── Context-aware empty messages ───────────────────────────────────────────
    if (total === 0) {
      let message: string;

      if (search && search.trim() !== '') {
        message = `No doctors found matching the name "${search.trim()}".`;
      } else if (specialization && specialization.trim() !== '') {
        message = `No doctors found with specialization "${specialization.trim()}".`;
      } else if (availability === true) {
        message = 'No available doctors found at the moment.';
      } else if (availability === false) {
        message = 'No unavailable doctors found.';
      } else {
        message = 'No doctors are registered on the platform yet.';
      }

      return {
        message,
        doctors: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    return {
      message: 'Doctors fetched successfully',
      doctors,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /doctor/:id
   * Returns full doctor profile by ID.
   * Throws 404 if not found (including ID = 0 or negative).
   */
  async findById(id: number) {
    const doctor = await this.doctorProfileRepo.findOne({
      where: { id },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        experience: true,
        qualification: true,
        consultationFee: true,
        availabilityHours: true,
        profileDetails: true,
        isAvailable: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found.`);
    }

    return {
      message: 'Doctor profile fetched successfully',
      doctor,
    };
  }

  // ─── Legacy aliases (kept for backward compat with old controller routes) ────

  /** @deprecated Use findAll() */
  async getDoctors(query: {
    specialization?: string;
    search?: string;
    page?: string;
    limit?: string;
    availability?: string;
  }) {
    // Convert old string-based query to typed DTO
    const page = parseInt(query.page ?? '1', 10);
    let limit = parseInt(query.limit ?? '10', 10);

    if (isNaN(page) || page < 1) {
      throw new BadRequestException(
        'Invalid value for "page". Must be a positive integer.',
      );
    }
    if (isNaN(limit) || limit < 1) {
      throw new BadRequestException(
        'Invalid value for "limit". Must be a positive integer.',
      );
    }
    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (query.specialization && query.specialization.trim() !== '') {
      where.specialization = ILike(`%${query.specialization.trim()}%`);
    }
    if (query.search && query.search.trim() !== '') {
      where.fullName = ILike(`%${query.search.trim()}%`);
    }
    if (query.availability !== undefined) {
      where.isAvailable = query.availability === 'true';
    }

    const [doctors, total] = await this.doctorProfileRepo.findAndCount({
      where,
      select: {
        id: true,
        fullName: true,
        specialization: true,
        experience: true,
        consultationFee: true,
        isAvailable: true,
        availabilityHours: true,
      },
      skip,
      take: limit,
      order: { fullName: 'ASC' },
    });

    if (doctors.length === 0) {
      return {
        message: 'No doctors found matching the given criteria.',
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    return {
      message: 'Doctors fetched successfully',
      data: doctors,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** @deprecated Use findById() */
  async getDoctorById(id: number) {
    if (isNaN(id) || id < 1) {
      throw new BadRequestException(
        'Invalid doctor ID. Must be a positive integer.',
      );
    }

    const doctor = await this.doctorProfileRepo.findOne({
      where: { id },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        experience: true,
        qualification: true,
        consultationFee: true,
        availabilityHours: true,
        profileDetails: true,
        isAvailable: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found.`);
    }

    return {
      message: 'Doctor profile fetched successfully',
      data: doctor,
    };
  }
}
