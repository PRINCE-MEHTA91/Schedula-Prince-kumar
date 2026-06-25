import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { Appointment, AppointmentStatus } from '../appointment/entities/appointment.entity';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private recurringAvailabilityRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customAvailabilityRepo: Repository<CustomAvailability>,
    @InjectRepository(DoctorProfile)
    private doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
  ) {}

  private async getDoctorProfileByUserId(
    userId: number,
  ): Promise<DoctorProfile> {
    const profile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(
        'Invalid time range: startTime must be before endTime',
      );
    }
  }

  private checkOverlap(
    slots: { startTime: string; endTime: string }[],
    newSlot: { startTime: string; endTime: string },
  ) {
    for (const slot of slots) {
      if (
        newSlot.startTime < slot.endTime &&
        slot.startTime < newSlot.endTime
      ) {
        throw new BadRequestException(
          'Time slot overlaps with existing availability',
        );
      }
    }
  }

  async createRecurring(userId: number, dto: CreateRecurringAvailabilityDto) {
    const profile = await this.getDoctorProfileByUserId(userId);
    this.validateTimeRange(dto.startTime, dto.endTime);

    const existing = await this.recurringAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, dayOfWeek: dto.dayOfWeek },
    });
    this.checkOverlap(existing, {
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    const availability = this.recurringAvailabilityRepo.create({
      ...dto,
      doctorProfileId: profile.id,
      dayOfWeek: dto.dayOfWeek,
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

  async updateRecurring(
    userId: number,
    id: number,
    dto: UpdateRecurringAvailabilityDto,
  ) {
    const profile = await this.getDoctorProfileByUserId(userId);
    const availability = await this.recurringAvailabilityRepo.findOne({
      where: { id },
    });

    if (!availability) {
      throw new NotFoundException('Recurring availability not found');
    }

    if (availability.doctorProfileId !== profile.id) {
      throw new UnauthorizedException(
        'You can only update your own availability',
      );
    }

    const updatedDayOfWeek = dto.dayOfWeek || availability.dayOfWeek;
    const updatedStartTime = dto.startTime || availability.startTime;
    const updatedEndTime = dto.endTime || availability.endTime;

    this.validateTimeRange(updatedStartTime, updatedEndTime);

    const existing = await this.recurringAvailabilityRepo.find({
      where: {
        doctorProfileId: profile.id,
        dayOfWeek: updatedDayOfWeek,
      },
    });
    const otherSlots = existing.filter((slot) => slot.id !== id);
    this.checkOverlap(otherSlots, {
      startTime: updatedStartTime,
      endTime: updatedEndTime,
    });

    Object.assign(availability, dto);
    return this.recurringAvailabilityRepo.save(availability);
  }

  async deleteRecurring(userId: number, id: number) {
    const profile = await this.getDoctorProfileByUserId(userId);
    const availability = await this.recurringAvailabilityRepo.findOne({
      where: { id },
    });

    if (!availability) {
      throw new NotFoundException('Recurring availability not found');
    }

    if (availability.doctorProfileId !== profile.id) {
      throw new UnauthorizedException(
        'You can only delete your own availability',
      );
    }

    await this.recurringAvailabilityRepo.remove(availability);
    return { message: 'Availability deleted successfully' };
  }

  async createCustomOverride(userId: number, dto: CreateCustomAvailabilityDto) {
    const profile = await this.getDoctorProfileByUserId(userId);

    const isAvailable = dto.isAvailable !== false;
    if (isAvailable) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'startTime and endTime are required when isAvailable is true',
        );
      }
      this.validateTimeRange(dto.startTime, dto.endTime);

      const existing = await this.customAvailabilityRepo.find({
        where: {
          doctorProfileId: profile.id,
          date: dto.date,
          isAvailable: true,
        },
      });
      this.checkOverlap(existing as any, {
        startTime: dto.startTime,
        endTime: dto.endTime,
      });
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
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const customSlots = await this.customAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, date: dateStr },
      order: { startTime: 'ASC' },
    });

    if (customSlots.length > 0) {
      if (customSlots.some((slot) => !slot.isAvailable)) {
        return { date: dateStr, slots: [], type: 'custom-unavailable' };
      }
      return { date: dateStr, slots: customSlots, type: 'custom' };
    }

    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const dayOfWeek = days[date.getDay()];

    const recurringSlots = await this.recurringAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, dayOfWeek: dayOfWeek as any },
      order: { startTime: 'ASC' },
    });

    return { date: dateStr, slots: recurringSlots, type: 'recurring' };
  }

  async getAvailableSlots(doctorId: number, dateString: string) {
    const doctor = await this.doctorProfileRepo.findOne({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const targetDate = new Date(dateString);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDateZeroed = new Date(targetDate);
    targetDateZeroed.setHours(0, 0, 0, 0);

    if (targetDateZeroed < today) {
      throw new BadRequestException('Cannot fetch slots for past dates');
    }

    const slotDuration = doctor.slotDuration || 15;
    if (slotDuration <= 0) {
      throw new BadRequestException(
        'Invalid slot duration configured for doctor',
      );
    }

    let rawAvailabilities: { startTime: string; endTime: string }[] = [];

    const customAvailabilities = await this.customAvailabilityRepo.find({
      where: { doctorProfileId: doctorId, date: dateString },
    });

    if (customAvailabilities.length > 0) {
      rawAvailabilities = customAvailabilities
        .filter((c) => c.isAvailable && c.startTime && c.endTime)
        .map((c) => ({
          startTime: c.startTime as string,
          endTime: c.endTime as string,
        }));
    } else {
      const days = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const dayOfWeek = days[targetDate.getDay()];
      const recurringAvailabilities = await this.recurringAvailabilityRepo.find(
        {
          where: { doctorProfileId: doctorId, dayOfWeek: dayOfWeek as any },
        },
      );
      rawAvailabilities = recurringAvailabilities.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
      }));
    }

    if (rawAvailabilities.length === 0) {
      throw new NotFoundException('No availability for the given date');
    }

    let allSlots: { start: Date; end: Date }[] = [];
    for (const av of rawAvailabilities) {
      const slots = this.generateTimeSlots(
        dateString,
        av.startTime,
        av.endTime,
        slotDuration,
      );
      allSlots = [...allSlots, ...slots];
    }

    allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    const now = new Date();
    allSlots = allSlots.filter((slot) => slot.start > now);

    const appointments = await this.appointmentRepo.find({
      where: { doctorId, date: dateString, status: AppointmentStatus.CONFIRMED },
    });

    const availableSlots = allSlots.filter((slot) => {
      for (const appt of appointments) {
        const apptStart = new Date(`${dateString}T${appt.startTime}`);
        const apptEnd = new Date(`${dateString}T${appt.endTime}`);
        if (slot.start < apptEnd && slot.end > apptStart) {
          return false;
        }
      }
      return true;
    });

    if (availableSlots.length === 0) {
      throw new NotFoundException('No slots available for the given date');
    }

    const formattedSlots = availableSlots.map((slot) => ({
      startTime: slot.start.toTimeString().substring(0, 5),
      endTime: slot.end.toTimeString().substring(0, 5),
    }));

    return {
      message: 'Available slots fetched successfully',
      slots: formattedSlots,
    };
  }

  private generateTimeSlots(
    dateString: string,
    startTimeStr: string,
    endTimeStr: string,
    durationMin: number,
  ) {
    const slots: { start: Date; end: Date }[] = [];
    const currentSlotStart = new Date(`${dateString}T${startTimeStr}`);
    const availabilityEnd = new Date(`${dateString}T${endTimeStr}`);

    while (currentSlotStart < availabilityEnd) {
      const currentSlotEnd = new Date(currentSlotStart);
      currentSlotEnd.setMinutes(currentSlotEnd.getMinutes() + durationMin);

      if (currentSlotEnd <= availabilityEnd) {
        slots.push({
          start: new Date(currentSlotStart),
          end: new Date(currentSlotEnd),
        });
      }

      currentSlotStart.setMinutes(currentSlotStart.getMinutes() + durationMin);
    }
    return slots;
  }
}
