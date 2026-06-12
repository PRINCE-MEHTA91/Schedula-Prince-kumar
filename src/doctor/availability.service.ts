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
  }
}
