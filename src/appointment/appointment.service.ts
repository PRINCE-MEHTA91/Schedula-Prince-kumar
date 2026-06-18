import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

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
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(DoctorProfile)
    private readonly doctorRepo: Repository<DoctorProfile>,

    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
  ) { }

  // ─── 1. Book Appointment (PATIENT only) ──────────────────────────────────────

  async bookAppointment(patientUserId: number, dto: BookAppointmentDto) {
    // Step 1: Check doctor exists
    const doctor = await this.doctorRepo.findOne({
      where: { id: dto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(
        `Doctor with ID ${dto.doctorId} not found.`,
      );
    }

    // Step 2: Check patient profile exists
    const patient = await this.patientRepo.findOne({
      where: { userId: patientUserId },
    });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please complete your profile first.',
      );
    }

    // Step 3: Check appointment is for a future date and time
    // Combine date + startTime to compare with current time
    const appointmentDateTime = new Date(`${dto.date}T${dto.startTime}:00`);
    const now = new Date();
    if (appointmentDateTime <= now) {
      throw new BadRequestException(
        'Appointment must be scheduled for a future date and time.',
      );
    }

    // Step 4: Validate slot is within doctor's availability hours
    const parsedAvail = this.parseAvailability(doctor.availabilityHours);
    if (!parsedAvail) {
      throw new BadRequestException('Doctor has no valid availability hours set.');
    }

    const { startDay, endDay, startMin, endMin } = parsedAvail;
    const requestDay = appointmentDateTime.getDay(); // 0 for Sunday, 1 for Monday

    if (!this.isDayInRange(requestDay, startDay, endDay)) {
      throw new BadRequestException(`Doctor is not available on this day of the week.`);
    }

    const [reqHour, reqMinute] = dto.startTime.split(':').map(Number);
    const [reqEndHour, reqEndMinute] = dto.endTime.split(':').map(Number);
    const reqStartMin = reqHour * 60 + reqMinute;
    const reqEndMin = reqEndHour * 60 + reqEndMinute;

    if (reqStartMin < startMin || reqEndMin > endMin) {
      throw new BadRequestException(`Slot ${dto.startTime}-${dto.endTime} is outside doctor's availability hours.`);
    }

    // Step 5: Check this exact slot is not already booked (same doctor + date + startTime)
    const existing = await this.appointmentRepo.findOne({
      where: {
        doctorId: dto.doctorId,
        date: dto.date,
        startTime: dto.startTime,
        status: AppointmentStatus.BOOKED,
      },
    });
    if (existing) {
      throw new ConflictException(
        `This slot (${dto.startTime} on ${dto.date}) is already booked. Please choose another slot.`,
      );
    }

    // All checks passed — create the appointment
    const appointment = this.appointmentRepo.create({
      doctorId: dto.doctorId,
      patientId: patient.id,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
    });

    const saved = await this.appointmentRepo.save(appointment);

    return {
      message: 'Appointment booked successfully',
      appointment: saved,
    };
  }

  // ─── 2. Get Patient's Own Appointments ───────────────────────────────────────

  async getMyAppointments(patientUserId: number) {
    // First find the patient profile
    const patient = await this.patientRepo.findOne({
      where: { userId: patientUserId },
    });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please complete your profile first.',
      );
    }

    // Get all appointments for this patient with doctor info
    const appointments = await this.appointmentRepo.find({
      where: { patientId: patient.id },
      relations: { doctor: true }, // brings in DoctorProfile data
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      return {
        message: 'You have no appointments yet.',
        appointments: [],
      };
    }

    // Shape the response — only return what patient needs to see
    const result = appointments.map((appt) => ({
      id: appt.id,
      date: appt.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: appt.status,
      doctor: {
        id: appt.doctor.id,
        fullName: appt.doctor.fullName,
        specialization: appt.doctor.specialization,
        consultationFee: appt.doctor.consultationFee,
      },
    }));

    return {
      message: 'Appointments fetched successfully',
      appointments: result,
    };
  }

  // ─── 3. Reschedule Appointment (PATIENT only) ────────────────────────────────

  async rescheduleAppointment(appointmentId: number, patientUserId: number, dto: UpdateAppointmentDto) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: { doctor: true, patient: true },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.patient.userId !== patientUserId) throw new ForbiddenException('Not authorized to update this appointment');
    if (appointment.status === AppointmentStatus.CANCELLED) throw new BadRequestException('Cannot update a cancelled appointment');

    const newDate = dto.date || appointment.date;
    const newStartTime = dto.startTime || appointment.startTime;
    const newEndTime = dto.endTime || appointment.endTime;

    // Step 3: Check future date
    const appointmentDateTime = new Date(`${newDate}T${newStartTime}:00`);
    if (appointmentDateTime <= new Date()) throw new BadRequestException('Must be a future date and time');

    // Step 4: Validate against doctor's availability
    const parsedAvail = this.parseAvailability(appointment.doctor.availabilityHours);
    if (!parsedAvail) throw new BadRequestException('Doctor has no valid availability hours set.');

    const { startDay, endDay, startMin, endMin } = parsedAvail;
    const requestDateObj = new Date(`${newDate}T00:00:00`);
    const requestDay = requestDateObj.getDay();

    if (!this.isDayInRange(requestDay, startDay, endDay)) {
      throw new BadRequestException('Doctor is not available on this day of the week.');
    }

    const [reqHour, reqMinute] = newStartTime.split(':').map(Number);
    const [reqEndHour, reqEndMinute] = newEndTime.split(':').map(Number);
    const reqStartMin = reqHour * 60 + reqMinute;
    const reqEndMin = reqEndHour * 60 + reqEndMinute;

    if (reqStartMin < startMin || reqEndMin > endMin) {
      throw new BadRequestException('Slot is outside doctor\'s availability hours.');
    }

    // Step 5: Check overlap (ignoring this exact appointment)
    const existing = await this.appointmentRepo.findOne({
      where: {
        doctorId: appointment.doctorId,
        date: newDate,
        startTime: newStartTime,
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existing && existing.id !== appointment.id) {
      throw new ConflictException('This slot is already booked.');
    }

    appointment.date = newDate;
    appointment.startTime = newStartTime;
    appointment.endTime = newEndTime;

    return {
      message: 'Appointment updated successfully',
      appointment: await this.appointmentRepo.save(appointment),
    };
  }

  // ─── 4. Cancel Appointment (PATIENT only) ────────────────────────────────────

  async cancelAppointment(appointmentId: number, patientUserId: number) {
    // Find the appointment by ID
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });

    // Case 1: Appointment does not exist
    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found.`,
      );
    }

    // Find patient profile to verify ownership
    const patient = await this.patientRepo.findOne({
      where: { userId: patientUserId },
    });
    if (!patient) {
      throw new NotFoundException('Patient profile not found.');
    }

    // Case 2: Patient does not own this appointment
    if (appointment.patientId !== patient.id) {
      throw new ForbiddenException(
        'You are not authorized to cancel this appointment.',
      );
    }

    // Case 3: Already cancelled
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('This appointment is already cancelled.');
    }

    // Case 4: Past appointment cannot be cancelled
    const appointmentDateTime = new Date(
      `${appointment.date}T${appointment.startTime}:00`,
    );
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException(
        'Cannot cancel a past appointment.',
      );
    }

    // All good — mark as cancelled
    appointment.status = AppointmentStatus.CANCELLED;
    const updated = await this.appointmentRepo.save(appointment);

    return {
      message: 'Appointment cancelled successfully',
      appointment: updated,
    };
  }

  // ─── 5. Doctor's Appointment View (DOCTOR only) ──────────────────────────────

  async getDoctorAppointments(doctorUserId: number) {
    // Find doctor profile by userId
    const doctor = await this.doctorRepo.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please complete your profile first.',
      );
    }

    // Get all appointments for this doctor with patient info
    const appointments = await this.appointmentRepo.find({
      where: { doctorId: doctor.id },
      relations: { patient: true }, // brings in PatientProfile data
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      return {
        message: 'No appointments found.',
        appointments: [],
      };
    }

    // Shape the response — only return what doctor needs to see
    const result = appointments.map((appt) => ({
      id: appt.id,
      date: appt.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: appt.status,
      patient: {
        id: appt.patient.id,
        fullName: appt.patient.fullName,
        age: appt.patient.age,
        gender: appt.patient.gender,
        contactDetails: appt.patient.contactDetails,
      },
    }));

    return {
      message: 'Appointments fetched successfully',
      appointments: result,
    };
  }

  // ─── 6. Get Available Slots ──────────────────────────────────────────────────

  async getAvailableSlots(doctorId: number, date: string) {
    // 1. Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    // 2. Check if doctor exists
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);
    }

    if (!doctor.isAvailable) {
      return {
        message: 'Doctor is currently not available for new appointments.',
        slots: [],
      };
    }

    // 3. Extract and validate availability hours
    const parsedAvail = this.parseAvailability(doctor.availabilityHours);
    if (!parsedAvail) {
      return {
        message: 'Doctor has no valid availability hours set.',
        slots: [],
      };
    }

    const { startDay, endDay, startMin, endMin } = parsedAvail;

    // We add T00:00:00 to avoid timezone shifts affecting the local day
    const requestDateObj = new Date(`${date}T00:00:00`);
    const requestDay = requestDateObj.getDay();

    if (!this.isDayInRange(requestDay, startDay, endDay)) {
      return {
        message: 'Doctor is not available on this day of the week.',
        slots: [],
      };
    }

    // 4. Fetch already booked appointments for this doctor on this date
    const bookedAppointments = await this.appointmentRepo.find({
      where: {
        doctorId,
        date,
        status: AppointmentStatus.BOOKED,
      },
      select: { startTime: true, endTime: true },
    });

    // Extract booked start times for easy lookup
    // Using 30-min slots
    const slotDurationMinutes = 30;
    const slots: { startTime: string; endTime: string }[] = [];

    let currentMin = startMin;

    while (currentMin + slotDurationMinutes <= endMin) {
      const slotStartHour = String(Math.floor(currentMin / 60)).padStart(2, '0');
      const slotStartMin = String(currentMin % 60).padStart(2, '0');
      const startTime = `${slotStartHour}:${slotStartMin}`;

      const nextMin = currentMin + slotDurationMinutes;
      const slotEndHour = String(Math.floor(nextMin / 60)).padStart(2, '0');
      const slotEndMin = String(nextMin % 60).padStart(2, '0');
      const endTime = `${slotEndHour}:${slotEndMin}`;

      // Check if this slot overlaps with any booked appointment
      const isBooked = bookedAppointments.some((appt) => {
        return (startTime < appt.endTime) && (endTime > appt.startTime);
      });

      if (!isBooked) {
        slots.push({ startTime, endTime });
      }

      currentMin += slotDurationMinutes;
    }

    return {
      message: 'Available slots fetched successfully',
      date,
      slots,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private parseAvailability(availabilityStr: string) {
    // Expected format: "Mon-Sat 10am-4pm" or "Mon-Fri 09:00am-05:00pm"
    // Regex matches: 1=startDay, 2=endDay, 3=startTime, 4=endTime
    const regex = /([A-Za-z]+)-([A-Za-z]+)\s+(\d{1,2}(?::\d{2})?(?:am|pm|AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?(?:am|pm|AM|PM))/;
    const match = availabilityStr.match(regex);

    if (!match) return null;

    const dayMap: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    };

    const startDay = dayMap[match[1].toLowerCase().slice(0, 3)];
    const endDay = dayMap[match[2].toLowerCase().slice(0, 3)];

    if (startDay === undefined || endDay === undefined) return null;

    const parseTime = (timeStr: string) => {
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?(am|pm|AM|PM)/i);
      if (!timeMatch) return null;
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2] || '0', 10);
      const ampm = timeMatch[3].toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      return hours * 60 + minutes;
    };

    const startMin = parseTime(match[3]);
    const endMin = parseTime(match[4]);

    if (startMin === null || endMin === null) return null;

    return { startDay, endDay, startMin, endMin };
  }

  private isDayInRange(day: number, startDay: number, endDay: number): boolean {
    if (startDay <= endDay) {
      return day >= startDay && day <= endDay;
    } else {
      // Handles wrapping around the week, e.g., "Sat-Sun" (6 to 0)
      return day >= startDay || day <= endDay;
    }
  }
}
