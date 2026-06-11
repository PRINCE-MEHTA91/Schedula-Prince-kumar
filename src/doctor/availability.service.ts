import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { ERROR_MESSAGES, RESPONSE_MESSAGES } from '../constants/messages';
import { AvailabilityType } from './enums/availability-type.enum';
import { DayOfWeek } from './enums/day-of-week.enum';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private recurringAvailabilityRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customAvailabilityRepo: Repository<CustomAvailability>,
    @InjectRepository(DoctorProfile)
    private doctorProfileRepo: Repository<DoctorProfile>,
  ) {}

  private async getDoctorProfileByUserId(userId: number): Promise<DoctorProfile> {
    const profile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(ERROR_MESSAGES.DOCTOR_PROFILE_NOT_FOUND);
    }
    return profile;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(ERROR_MESSAGES.TIME_RANGE_INVALID);
    }
  }

  private checkOverlap(
    slots: { startTime: string; endTime: string }[],
    newSlot: { startTime: string; endTime: string },
  ) {
    for (const slot of slots) {
      // Overlap condition: start1 < end2 AND start2 < end1
      if (newSlot.startTime < slot.endTime && slot.startTime < newSlot.endTime) {
        throw new BadRequestException(ERROR_MESSAGES.OVERLAP);
      }
    }
  }

  async createRecurring(userId: number, dto: CreateRecurringAvailabilityDto) {
    const profile = await this.getDoctorProfileByUserId(userId);
    this.validateTimeRange(dto.startTime, dto.endTime);

    // Check for overlaps
    const existing = await this.recurringAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, dayOfWeek: dto.dayOfWeek },
    });

    const isDuplicate = existing.some(
      (slot) => slot.startTime === dto.startTime && slot.endTime === dto.endTime,
    );
    if (isDuplicate) {
      throw new BadRequestException(ERROR_MESSAGES.DUPLICATE_SLOT);
    }

    this.checkOverlap(existing, { startTime: dto.startTime, endTime: dto.endTime });

    const availability = this.recurringAvailabilityRepo.create({
      ...dto,
      doctorProfileId: profile.id,
    });

    return this.recurringAvailabilityRepo.save(availability);
  }

  async getRecurring(userId: number) {
    const profile = await this.getDoctorProfileByUserId(userId);
    return this.recurringAvailabilityRepo.find({
      where: { doctorProfileId: profile.id },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async updateRecurring(userId: number, id: number, dto: UpdateRecurringAvailabilityDto) {
    const profile = await this.getDoctorProfileByUserId(userId);
    const availability = await this.recurringAvailabilityRepo.findOne({ where: { id } });

    if (!availability) {
      throw new NotFoundException(ERROR_MESSAGES.RECURRING_NOT_FOUND);
    }

    if (availability.doctorProfileId !== profile.id) {
      throw new ForbiddenException(ERROR_MESSAGES.UNAUTHORIZED_UPDATE);
    }

    const updatedDayOfWeek = dto.dayOfWeek || availability.dayOfWeek;
    const updatedStartTime = dto.startTime || availability.startTime;
    const updatedEndTime = dto.endTime || availability.endTime;

    this.validateTimeRange(updatedStartTime, updatedEndTime);

    // Check overlaps excluding current slot
    const existing = await this.recurringAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, dayOfWeek: updatedDayOfWeek },
    });
    const otherSlots = existing.filter((slot) => slot.id !== id);
    this.checkOverlap(otherSlots, { startTime: updatedStartTime, endTime: updatedEndTime });

    Object.assign(availability, dto);
    return this.recurringAvailabilityRepo.save(availability);
  }

  async deleteRecurring(userId: number, id: number) {
    const profile = await this.getDoctorProfileByUserId(userId);
    const availability = await this.recurringAvailabilityRepo.findOne({ where: { id } });

    if (!availability) {
      throw new NotFoundException(ERROR_MESSAGES.RECURRING_NOT_FOUND);
    }

    if (availability.doctorProfileId !== profile.id) {
      throw new ForbiddenException(ERROR_MESSAGES.UNAUTHORIZED_DELETE);
    }

    await this.recurringAvailabilityRepo.remove(availability);
    return { message: RESPONSE_MESSAGES.DELETE_SUCCESS };
  }

  async createCustomOverride(userId: number, dto: CreateCustomAvailabilityDto) {
    const profile = await this.getDoctorProfileByUserId(userId);

    const isAvailable = dto.isAvailable !== false; // defaults to true
    if (isAvailable) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(ERROR_MESSAGES.TIME_RANGE_REQUIRED);
      }
      this.validateTimeRange(dto.startTime, dto.endTime);

      // Check for overlaps with other custom slots on the same date
      const existing = await this.customAvailabilityRepo.find({
        where: { doctorProfileId: profile.id, date: dto.date, isAvailable: true },
      });
      this.checkOverlap(existing, { startTime: dto.startTime, endTime: dto.endTime });
    }

    const override = this.customAvailabilityRepo.create({
      doctorProfileId: profile.id,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isAvailable,
    });

    return this.customAvailabilityRepo.save(override);
  }

  async getAvailabilityByDate(userId: number, dateStr: string) {
    const profile = await this.getDoctorProfileByUserId(userId);
    const date = new Date(dateStr);

    // Check custom availability first
    const customSlots = await this.customAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, date: dateStr },
      order: { startTime: 'ASC' },
    });

    if (customSlots.length > 0) {
      // If there's an entry marking the day as unavailable, return empty slots
      if (customSlots.some((slot) => !slot.isAvailable)) {
        return { date: dateStr, slots: [], type: AvailabilityType.CUSTOM_UNAVAILABLE };
      }
      return { date: dateStr, slots: customSlots, type: AvailabilityType.CUSTOM };
    }

    // Fallback to recurring
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    const dayOfWeek = days[date.getDay()];

    const recurringSlots = await this.recurringAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, dayOfWeek },
      order: { startTime: 'ASC' },
    });

    return { date: dateStr, slots: recurringSlots, type: AvailabilityType.RECURRING };
  }
}
