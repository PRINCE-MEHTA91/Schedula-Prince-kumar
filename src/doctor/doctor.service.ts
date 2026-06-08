import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
  ) {}

  async createProfile(userId: number, dto: CreateDoctorProfileDto) {
    // Prevent duplicate profile creation
    const existing = await this.doctorProfileRepo.findOne({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException(
        'Doctor profile already exists. Use PATCH to update.',
      );
    }

    const profile = this.doctorProfileRepo.create({
      ...dto,
      userId,
    });

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

    const updated = await this.doctorProfileRepo.save({
      ...profile,
      ...dto,
    });

    return {
      message: 'Doctor profile updated successfully',
      profile: updated,
    };
  }
}
