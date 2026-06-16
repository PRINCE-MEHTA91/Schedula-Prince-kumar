import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DoctorSchedule,
  SchedulingType,
} from './entities/doctor-schedule.entity';
import { AppointmentSlot } from './entities/appointment-slot.entity';
import { WaveBooking } from './entities/wave-booking.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepo: Repository<DoctorSchedule>,

    @InjectRepository(AppointmentSlot)
    private readonly slotRepo: Repository<AppointmentSlot>,

    @InjectRepository(WaveBooking)
    private readonly waveBookingRepo: Repository<WaveBooking>,

    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,

    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
  ) {}

  // ─── Time Utilities ──────────────────────────────────────────────────────────

  /** Convert "HH:MM" → total minutes from midnight */
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /** Convert total minutes → "HH:MM" */
  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Check if a date string (YYYY-MM-DD) is strictly in the past */
  private isDateInPast(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return target < today;
  }

  // ─── Create Schedule (DOCTOR) ────────────────────────────────────────────────

  /**
   * POST /appointment/schedule
   * Doctor creates either a STREAM or WAVE schedule for a given date + time window.
   * STREAM: generates individual slots; WAVE: creates one wave with capacity.
   */
  async createSchedule(doctorUserId: number, dto: CreateScheduleDto) {
    // 1. Resolve doctor profile from JWT user id
    const doctor = await this.doctorProfileRepo.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please complete onboarding first.',
      );
    }

    // 2. Validate times
    const startMin = this.timeToMinutes(dto.startTime);
    const endMin = this.timeToMinutes(dto.endTime);

    if (endMin <= startMin) {
      throw new BadRequestException(
        `endTime (${dto.endTime}) must be after startTime (${dto.startTime}).`,
      );
    }

    const windowMinutes = endMin - startMin;

    // 3. Reject past dates
    if (this.isDateInPast(dto.date)) {
      throw new BadRequestException(
        `Cannot create a schedule for a past date (${dto.date}).`,
      );
    }

    // 4. Detect overlapping schedules (any partial overlap same doctor, same date)
    const existingOnDate = await this.scheduleRepo.find({
      where: { doctorId: doctor.id, date: dto.date },
    });

    for (const existing of existingOnDate) {
      const exStart = this.timeToMinutes(existing.startTime);
      const exEnd = this.timeToMinutes(existing.endTime);
      const overlaps = !(endMin <= exStart || startMin >= exEnd);
      if (overlaps) {
        throw new ConflictException(
          `Schedule overlaps with an existing ${existing.schedulingType} schedule ` +
            `(${existing.startTime}–${existing.endTime}) on ${dto.date}. ` +
            `Please choose a different time window.`,
        );
      }
    }

    // 5. STREAM — validate fields and generate slots
    if (dto.schedulingType === SchedulingType.STREAM) {
      const slotDuration = dto.slotDuration;
      if (!slotDuration || slotDuration <= 0) {
        throw new BadRequestException(
          'slotDuration is required and must be a positive integer (minutes) for STREAM scheduling.',
        );
      }

      if (slotDuration > windowMinutes) {
        throw new BadRequestException(
          `slotDuration (${slotDuration} min) exceeds the available window (${windowMinutes} min).`,
        );
      }

      const buffer = dto.bufferTime ?? 0;
      const stepSize = slotDuration + buffer;

      // Check at least 1 slot fits
      if (stepSize > windowMinutes) {
        throw new BadRequestException(
          `slotDuration (${slotDuration}) + bufferTime (${buffer}) = ${stepSize} min ` +
            `exceeds the available window (${windowMinutes} min). No slots can be generated.`,
        );
      }

      // Persist schedule record first
      const schedule = await this.scheduleRepo.save(
        this.scheduleRepo.create({
          doctorId: doctor.id,
          schedulingType: SchedulingType.STREAM,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          slotDuration,
          bufferTime: buffer,
          maxCapacity: null,
        }),
      );

      // Generate slots
      const slots: Partial<AppointmentSlot>[] = [];
      let cursor = startMin;

      while (cursor + slotDuration <= endMin) {
        slots.push({
          scheduleId: schedule.id,
          startTime: this.minutesToTime(cursor),
          endTime: this.minutesToTime(cursor + slotDuration),
          isBooked: false,
          patientId: null,
        });
        cursor += stepSize;
      }

      const savedSlots = await this.slotRepo.save(slots);

      return {
        message: 'STREAM schedule created successfully',
        schedule: {
          id: schedule.id,
          date: schedule.date,
          schedulingType: 'STREAM',
          window: `${schedule.startTime} – ${schedule.endTime}`,
          slotDuration: `${slotDuration} min`,
          bufferTime: `${buffer} min`,
          totalSlotsGenerated: savedSlots.length,
        },
        slots: savedSlots.map((s) => ({
          id: s.id,
          time: `${s.startTime} – ${s.endTime}`,
          status: 'Available',
        })),
      };
    }

    // 6. WAVE — validate fields and create wave record
    if (dto.schedulingType === SchedulingType.WAVE) {
      const maxCapacity = dto.maxCapacity;
      if (!maxCapacity || maxCapacity <= 0) {
        throw new BadRequestException(
          'maxCapacity is required and must be a positive integer for WAVE scheduling.',
        );
      }

      if (maxCapacity > 500) {
        throw new BadRequestException(
          'maxCapacity cannot exceed 500 patients per wave.',
        );
      }

      const schedule = await this.scheduleRepo.save(
        this.scheduleRepo.create({
          doctorId: doctor.id,
          schedulingType: SchedulingType.WAVE,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          slotDuration: null,
          bufferTime: null,
          maxCapacity,
        }),
      );

      return {
        message: 'WAVE schedule created successfully',
        schedule: {
          id: schedule.id,
          date: schedule.date,
          schedulingType: 'WAVE',
          appointmentWindow: `${schedule.startTime} – ${schedule.endTime}`,
          maxCapacity: schedule.maxCapacity,
          booked: 0,
          available: `0/${schedule.maxCapacity}`,
          status: 'Open for bookings',
        },
      };
    }

    throw new BadRequestException(
      'Invalid schedulingType. Must be STREAM or WAVE.',
    );
  }

  // ─── Get Doctor's Own Schedules (DOCTOR) ─────────────────────────────────────

  /**
   * GET /appointment/schedule
   * Returns all schedules belonging to the authenticated doctor.
   */
  async getDoctorSchedules(doctorUserId: number) {
    const doctor = await this.doctorProfileRepo.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please complete onboarding first.',
      );
    }

    const schedules = await this.scheduleRepo.find({
      where: { doctorId: doctor.id },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (schedules.length === 0) {
      return {
        message: 'No schedules found. Create your first schedule.',
        schedules: [],
      };
    }

    const result = await Promise.all(
      schedules.map(async (s) => {
        if (s.schedulingType === SchedulingType.STREAM) {
          const [total, booked] = await Promise.all([
            this.slotRepo.count({ where: { scheduleId: s.id } }),
            this.slotRepo.count({ where: { scheduleId: s.id, isBooked: true } }),
          ]);
          return {
            id: s.id,
            date: s.date,
            schedulingType: 'STREAM',
            window: `${s.startTime} – ${s.endTime}`,
            slotDuration: `${s.slotDuration} min`,
            bufferTime: `${s.bufferTime} min`,
            totalSlots: total,
            bookedSlots: booked,
            availableSlots: total - booked,
          };
        } else {
          const booked = await this.waveBookingRepo.count({
            where: { scheduleId: s.id },
          });
          return {
            id: s.id,
            date: s.date,
            schedulingType: 'WAVE',
            appointmentWindow: `${s.startTime} – ${s.endTime}`,
            maxCapacity: s.maxCapacity,
            booked,
            available: s.maxCapacity! - booked,
            capacityStatus: `${booked}/${s.maxCapacity}`,
            isFull: booked >= s.maxCapacity!,
          };
        }
      }),
    );

    return {
      message: 'Schedules fetched successfully',
      total: result.length,
      schedules: result,
    };
  }

  // ─── Get Availability (PATIENT) ──────────────────────────────────────────────

  /**
   * GET /appointment/:scheduleId/slots
   * Patient views the availability of a given schedule.
   * STREAM: returns slot list with booked/available status.
   * WAVE:   returns time window + current capacity count.
   */
  async getAvailability(scheduleId: number) {
    const schedule = await this.scheduleRepo.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${scheduleId} not found.`);
    }

    const doctor = await this.doctorProfileRepo.findOne({
      where: { id: schedule.doctorId },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        consultationFee: true,
      },
    });

    // ── STREAM ──────────────────────────────────────────────────────────────────
    if (schedule.schedulingType === SchedulingType.STREAM) {
      const slots = await this.slotRepo.find({
        where: { scheduleId: schedule.id },
        order: { startTime: 'ASC' },
      });

      const available = slots.filter((s) => !s.isBooked);

      return {
        message: 'Stream schedule — exact appointment slots',
        scheduleId: schedule.id,
        schedulingType: 'STREAM',
        doctor: {
          id: doctor?.id,
          name: doctor?.fullName,
          specialization: doctor?.specialization,
          consultationFee: doctor?.consultationFee,
        },
        date: schedule.date,
        window: `${schedule.startTime} – ${schedule.endTime}`,
        slotDuration: `${schedule.slotDuration} min`,
        slots: slots.map((s) => ({
          slotId: s.id,
          time: `${s.startTime} – ${s.endTime}`,
          status: s.isBooked ? 'Booked' : 'Available',
        })),
        summary: {
          total: slots.length,
          available: available.length,
          booked: slots.length - available.length,
        },
      };
    }

    // ── WAVE ─────────────────────────────────────────────────────────────────────
    const bookedCount = await this.waveBookingRepo.count({
      where: { scheduleId: schedule.id },
    });
    const isFull = bookedCount >= schedule.maxCapacity!;

    return {
      message: 'Wave schedule — token-based appointment',
      scheduleId: schedule.id,
      schedulingType: 'WAVE',
      doctor: {
        id: doctor?.id,
        name: doctor?.fullName,
        specialization: doctor?.specialization,
        consultationFee: doctor?.consultationFee,
      },
      date: schedule.date,
      appointmentWindow: `${schedule.startTime} – ${schedule.endTime}`,
      capacity: {
        total: schedule.maxCapacity,
        booked: bookedCount,
        available: schedule.maxCapacity! - bookedCount,
        status: `${bookedCount}/${schedule.maxCapacity} booked`,
      },
      waveFull: isFull,
      note: isFull
        ? 'This wave is full. No more bookings are accepted.'
        : 'Book now to receive your token number. Arrive during the appointment window.',
    };
  }

  // ─── Book Appointment (PATIENT) ──────────────────────────────────────────────

  /**
   * POST /appointment/book
   * Patient books a slot (STREAM) or a wave token (WAVE).
   * Handles: duplicate bookings, full capacity, wrong slotId, past schedules.
   */
  async bookAppointment(patientUserId: number, dto: BookAppointmentDto) {
    // 1. Resolve patient profile
    const patient = await this.patientProfileRepo.findOne({
      where: { userId: patientUserId },
    });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please complete onboarding first.',
      );
    }

    // 2. Find schedule
    const schedule = await this.scheduleRepo.findOne({
      where: { id: dto.scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException(
        `Schedule with ID ${dto.scheduleId} not found.`,
      );
    }

    // 3. Reject past schedules
    if (this.isDateInPast(schedule.date)) {
      throw new BadRequestException(
        `Cannot book an appointment for a past schedule (${schedule.date}).`,
      );
    }

    // 4. Resolve doctor name for response
    const doctor = await this.doctorProfileRepo.findOne({
      where: { id: schedule.doctorId },
      select: { id: true, fullName: true, specialization: true },
    });

    // ── STREAM BOOKING ───────────────────────────────────────────────────────────
    if (schedule.schedulingType === SchedulingType.STREAM) {
      if (!dto.slotId) {
        throw new BadRequestException(
          'slotId is required when booking a STREAM schedule. ' +
            'Fetch available slots via GET /appointment/:scheduleId/slots and pick one.',
        );
      }

      // Verify slot belongs to this schedule
      const slot = await this.slotRepo.findOne({
        where: { id: dto.slotId, scheduleId: schedule.id },
      });
      if (!slot) {
        throw new NotFoundException(
          `Slot ID ${dto.slotId} does not exist in schedule ${dto.scheduleId}.`,
        );
      }

      // Slot already taken?
      if (slot.isBooked) {
        throw new ConflictException(
          `Slot ${slot.startTime} – ${slot.endTime} is already booked. Please choose another slot.`,
        );
      }

      // Duplicate booking guard — patient already has a slot in this schedule
      const alreadyBooked = await this.slotRepo.findOne({
        where: { scheduleId: schedule.id, patientId: patient.id },
      });
      if (alreadyBooked) {
        throw new ConflictException(
          `You already have an appointment booked in this schedule ` +
            `(${alreadyBooked.startTime} – ${alreadyBooked.endTime}).`,
        );
      }

      // Confirm booking
      slot.isBooked = true;
      slot.patientId = patient.id;
      await this.slotRepo.save(slot);

      return {
        message: '✅ Appointment booked successfully!',
        bookingType: 'STREAM',
        appointment: {
          doctor: doctor?.fullName,
          specialization: doctor?.specialization,
          date: schedule.date,
          appointmentTime: `${slot.startTime} – ${slot.endTime}`,
          patient: patient.fullName,
          slotId: slot.id,
        },
      };
    }

    // ── WAVE BOOKING ─────────────────────────────────────────────────────────────
    if (schedule.schedulingType === SchedulingType.WAVE) {
      // Duplicate booking guard
      const existingToken = await this.waveBookingRepo.findOne({
        where: { scheduleId: schedule.id, patientId: patient.id },
      });
      if (existingToken) {
        throw new ConflictException(
          `You already hold Token #${existingToken.tokenNumber} for this wave ` +
            `(${schedule.startTime} – ${schedule.endTime} on ${schedule.date}).`,
        );
      }

      // Capacity check — fetch current count atomically
      const currentCount = await this.waveBookingRepo.count({
        where: { scheduleId: schedule.id },
      });
      if (currentCount >= schedule.maxCapacity!) {
        throw new ConflictException(
          `This wave (${schedule.startTime} – ${schedule.endTime}) is full. ` +
            `Maximum capacity of ${schedule.maxCapacity} patients has been reached. No overbooking allowed.`,
        );
      }

      const tokenNumber = currentCount + 1;

      const booking = await this.waveBookingRepo.save(
        this.waveBookingRepo.create({
          scheduleId: schedule.id,
          patientId: patient.id,
          tokenNumber,
        }),
      );

      return {
        message: '✅ Appointment booked successfully!',
        bookingType: 'WAVE',
        appointment: {
          doctor: doctor?.fullName,
          specialization: doctor?.specialization,
          date: schedule.date,
          appointmentWindow: `${schedule.startTime} – ${schedule.endTime}`,
          patient: patient.fullName,
          tokenNumber: booking.tokenNumber,
          queuePosition: `Token ${tokenNumber} of ${schedule.maxCapacity}`,
          remaining: schedule.maxCapacity! - tokenNumber,
        },
      };
    }

    throw new BadRequestException('Invalid scheduling type on this schedule.');
  }
}
