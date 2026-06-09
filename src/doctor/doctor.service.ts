import {
  ConflictException,
  Injectable,
  NotFoundException,
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

  // GET /doctor — filtered + paginated doctors ki list
  async findAll(query: GetDoctorsQueryDto) {
    const { specialization, search, availability, page = 1, limit = 10 } = query;

    const where: Record<string, any> = {}; // filters dynamically add honge

    if (specialization) where.specialization = ILike(`%${specialization}%`); // case-insensitive match
    if (search) where.fullName = ILike(`%${search}%`);                       // partial naam search
    if (availability !== undefined) where.isAvailable = availability;         // availability filter

    const skip = (page - 1) * limit; // kitne records skip karne hain

    const [doctors, total] = await this.doctorProfileRepo.findAndCount({
      where,
      select: { id: true, fullName: true, specialization: true, experience: true, consultationFee: true, isAvailable: true },
      skip,
      take: limit,
      order: { fullName: 'ASC' },
    });

    // empty hone par helpful message
    let message = 'Doctors fetched successfully';
    if (total === 0) {
      if (search)                       message = `No doctors found matching name "${search}".`;
      else if (specialization)          message = `No doctors found for specialization "${specialization}".`;
      else if (availability === true)   message = 'No available doctors found at the moment.';
      else if (availability === false)  message = 'No unavailable doctors found.';
      else                              message = 'No doctors are registered on the platform yet.';
    }

    return {
      message,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      doctors,
    };
  }

  // GET /doctor/:id — ek doctor ka full profile
  async findById(id: number) {
    const doctor = await this.doctorProfileRepo.findOne({
      where: { id },
      select: { id: true, fullName: true, specialization: true, experience: true, qualification: true, consultationFee: true, availabilityHours: true, isAvailable: true, profileDetails: true },
    });

    if (!doctor) throw new NotFoundException(`Doctor with ID ${id} not found.`); // 404

    return { message: 'Doctor profile fetched successfully', doctor };
  }

  // POST /doctor/profile — naya profile banao
  async createProfile(userId: number, dto: CreateDoctorProfileDto) {
    const existing = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (existing) throw new ConflictException('Doctor profile already exists. Use PATCH to update.'); // duplicate check

    const saved = await this.doctorProfileRepo.save(
      this.doctorProfileRepo.create({ ...dto, userId }),
    );
    return { message: 'Doctor profile created successfully', profile: saved };
  }

  // GET /doctor/profile — apna profile dekho
  async getProfile(userId: number) {
    const profile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Doctor profile not found. Please complete onboarding first.');

    return { message: 'Doctor profile fetched successfully', profile };
  }

  // PATCH /doctor/profile — profile update karo
  async updateProfile(userId: number, dto: UpdateDoctorProfileDto) {
    const profile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Doctor profile not found. Please create a profile first.');

    const updated = await this.doctorProfileRepo.save({ ...profile, ...dto });
    return { message: 'Doctor profile updated successfully', profile: updated };
  }
}
