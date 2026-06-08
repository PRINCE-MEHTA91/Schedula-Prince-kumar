import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientProfile } from './entities/patient-profile.entity';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
  ) {}

  async createProfile(userId: number, dto: CreatePatientProfileDto) {
    // Prevent duplicate profile creation
    const existing = await this.patientProfileRepo.findOne({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException(
        'Patient profile already exists. Use PATCH to update.',
      );
    }

    const profile = this.patientProfileRepo.create({
      ...dto,
      userId,
    });

    const saved = await this.patientProfileRepo.save(profile);

    return {
      message: 'Patient profile created successfully',
      profile: saved,
    };
  }

  async getProfile(userId: number) {
    const profile = await this.patientProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Patient profile not found. Please complete onboarding first.',
      );
    }

    return {
      message: 'Patient profile fetched successfully',
      profile,
    };
  }

  async updateProfile(userId: number, dto: UpdatePatientProfileDto) {
    const profile = await this.patientProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Patient profile not found. Please create a profile first.',
      );
    }

    const updated = await this.patientProfileRepo.save({
      ...profile,
      ...dto,
    });

    return {
      message: 'Patient profile updated successfully',
      profile: updated,
    };
  }
}
