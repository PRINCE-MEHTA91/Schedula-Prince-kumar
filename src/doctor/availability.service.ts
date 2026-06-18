import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { Appointment } from '../patient/entities/appointment.entity';
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
  ) {}

  async createRecurringAvailability(userId: number, dto: any) {
    const doctorProfile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!doctorProfile) throw new NotFoundException('Doctor profile not found');

    const dayMap: Record<string, number> = {
      SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
    };

    const availability = new RecurringAvailability();
    availability.doctorId  = doctorProfile.id;
    availability.dayOfWeek = dayMap[dto.dayOfWeek];
    availability.startTime = dto.startTime + ':00';
    availability.endTime   = dto.endTime   + ':00';

    return this.recurringRepo.save(availability);
  }

  async createCustomAvailability(userId: number, dto: any) {
    const doctorProfile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!doctorProfile) throw new NotFoundException('Doctor profile not found');

    const availability = new CustomAvailability();
    availability.doctorId    = doctorProfile.id;
    availability.date        = dto.date;
    availability.startTime   = dto.startTime ? dto.startTime + ':00' : null;
    availability.endTime     = dto.endTime   ? dto.endTime   + ':00' : null;
    availability.isAvailable = dto.isAvailable !== undefined ? dto.isAvailable : true;

    return this.customRepo.save(availability);
  }

  async getAvailableSlots(doctorId: number, dateString: string) {
    // 1. Validate Doctor
    const doctor = await this.doctorProfileRepo.findOne({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // 2. Validate Date
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
      throw new BadRequestException('Invalid slot duration configured for doctor');
    }

    // 3. Resolve Availability (Custom vs Recurring)
    let rawAvailabilities: { startTime: string; endTime: string }[] = [];

    const customAvailabilities = await this.customRepo.find({
      where: { doctorId, date: dateString },
    });

    if (customAvailabilities.length > 0) {
      // Custom overrides existing - check if they are available
      rawAvailabilities = customAvailabilities
        .filter((c) => c.isAvailable && c.startTime && c.endTime)
        .map((c) => ({
          startTime: c.startTime as string,
          endTime: c.endTime as string,
        }));
    } else {
      // Fallback to recurring
      const dayOfWeek = targetDate.getDay();
      const recurringAvailabilities = await this.recurringRepo.find({
        where: { doctorId, dayOfWeek },
      });
      rawAvailabilities = recurringAvailabilities.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
      }));
    }

    if (rawAvailabilities.length === 0) {
      throw new NotFoundException('No availability for the given date');
    }

    // 4. Generate Slots
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

    // Sort all slots by start time
    allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    // 5. Filter past slots if the date is today
    const now = new Date();
    allSlots = allSlots.filter((slot) => slot.start > now);

    // 6. Filter booked slots
    const appointments = await this.appointmentRepo.find({
      where: { doctorId, date: dateString, status: 'BOOKED' },
    });

    const availableSlots = allSlots.filter((slot) => {
      // Check if this slot overlaps with any appointment
      for (const appt of appointments) {
        const apptStart = new Date(`${dateString}T${appt.startTime}`);
        const apptEnd = new Date(`${dateString}T${appt.endTime}`);

        // Overlap condition:
        // Slot start < Appt end AND Slot end > Appt start
        if (slot.start < apptEnd && slot.end > apptStart) {
          return false; // Overlaps, so not available
        }
      }
      return true; // No overlap
    });

    if (availableSlots.length === 0) {
      throw new NotFoundException('No slots available for the given date');
    }

    // Format slots for response
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

    // Assuming times are like '10:00:00' or '10:00'
    const currentSlotStart = new Date(`${dateString}T${startTimeStr}`);
    const availabilityEnd = new Date(`${dateString}T${endTimeStr}`);

    while (currentSlotStart < availabilityEnd) {
      const currentSlotEnd = new Date(currentSlotStart);
      currentSlotEnd.setMinutes(currentSlotEnd.getMinutes() + durationMin);

      // We only add the slot if it doesn't exceed the end time
      if (currentSlotEnd <= availabilityEnd) {
        slots.push({
          start: new Date(currentSlotStart),
          end: new Date(currentSlotEnd),
        });
      }

      // Move to next slot
      currentSlotStart.setMinutes(currentSlotStart.getMinutes() + durationMin);
    }

    return slots;
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
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException('Invalid time range: startTime must be before endTime');
    }
  }

  private checkOverlap(
    slots: { startTime: string; endTime: string }[],
    newSlot: { startTime: string; endTime: string },
  ) {
    for (const slot of slots) {
      // Overlap condition: start1 < end2 AND start2 < end1
      if (newSlot.startTime < slot.endTime && slot.startTime < newSlot.endTime) {
        throw new BadRequestException('Time slot overlaps with existing availability');
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
      throw new NotFoundException('Recurring availability not found');
    }

    if (availability.doctorProfileId !== profile.id) {
      throw new UnauthorizedException('You can only update your own availability');
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
      throw new NotFoundException('Recurring availability not found');
    }

    if (availability.doctorProfileId !== profile.id) {
      throw new UnauthorizedException('You can only delete your own availability');
    }

    await this.recurringAvailabilityRepo.remove(availability);
    return { message: 'Availability deleted successfully' };
  }

  async createCustomOverride(userId: number, dto: CreateCustomAvailabilityDto) {
    const profile = await this.getDoctorProfileByUserId(userId);

    const isAvailable = dto.isAvailable !== false; // defaults to true
    if (isAvailable) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException('startTime and endTime are required when isAvailable is true');
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

    // Date validation
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Check custom availability first
    const customSlots = await this.customAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, date: dateStr },
      order: { startTime: 'ASC' },
    });

    if (customSlots.length > 0) {
      // If there's an entry marking the day as unavailable, return empty slots
      if (customSlots.some((slot) => !slot.isAvailable)) {
        return { date: dateStr, slots: [], type: 'custom-unavailable' };
      }
      return { date: dateStr, slots: customSlots, type: 'custom' };
    }

    // Fallback to recurring
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[date.getDay()];

    const recurringSlots = await this.recurringAvailabilityRepo.find({
      where: { doctorProfileId: profile.id, dayOfWeek: dayOfWeek as any },
      order: { startTime: 'ASC' },
    });

    return { date: dateStr, slots: recurringSlots, type: 'recurring' };
  }
}
