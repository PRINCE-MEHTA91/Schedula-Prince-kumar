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
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(StreamSlot)
    private readonly streamSlotRepo: Repository<StreamSlot>,
    @InjectRepository(WaveSchedule)
    private readonly waveScheduleRepo: Repository<WaveSchedule>,
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Doctor: Slot / Wave Management ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Doctor creates stream slots auto-generated from a time window.
   *
   * Given: date, startTime, endTime, slotDuration (min), bufferTime (min)
   * The system generates consecutive slots within the window.
   *
   * Example: 10:00–11:00, slotDuration=15, bufferTime=5
   *   → 10:00–10:15, 10:20–10:35, 10:40–10:55
   */
  async createStreamSlot(doctorUserId: number, dto: CreateStreamSlotDto) {
    const doctorProfile = await this.getDoctorProfileByUserId(doctorUserId);

    this.validateFutureDateTime(dto.date, dto.startTime);
    this.validateTimeOrder(dto.startTime, dto.endTime);

    const bufferTime = dto.bufferTime ?? 0;
    const slotDuration = dto.slotDuration;

    // ── Convert HH:MM to total minutes from midnight ────────────────────────
    const toMinutes = (hhmm: string): number => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    const toHHMM = (totalMinutes: number): string => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const windowStart = toMinutes(dto.startTime);
    const windowEnd = toMinutes(dto.endTime);

    if (slotDuration >= windowEnd - windowStart) {
      throw new BadRequestException(
        `slotDuration (${slotDuration} min) must be less than the total window ` +
          `(${windowEnd - windowStart} min).`,
      );
    }

    // ── Generate slots ──────────────────────────────────────────────────────
    const slotsToCreate: Partial<StreamSlot>[] = [];
    let current = windowStart;

    while (current + slotDuration <= windowEnd) {
      const slotStart = toHHMM(current);
      const slotEnd = toHHMM(current + slotDuration);

      slotsToCreate.push({
        doctorId: doctorProfile.id,
        date: dto.date,
        startTime: slotStart,
        endTime: slotEnd,
        isAvailable: true,
        isBooked: false,
      });

      current += slotDuration + bufferTime;
    }

    if (slotsToCreate.length === 0) {
      throw new BadRequestException(
        'No slots could be generated. Check slotDuration vs the time window.',
      );
    }

    const entities = this.streamSlotRepo.create(slotsToCreate);
    const saved = await this.streamSlotRepo.save(entities);

    return {
      message: `${saved.length} stream slot(s) created successfully`,
      totalSlots: saved.length,
      slots: saved,
    };
  }

  /**
   * Unified entry point — creates STREAM slots or a WAVE schedule
   * based on the schedulingType in the body.
   *
   * POST /appointment/schedule
   */
  async createSchedule(doctorUserId: number, dto: CreateScheduleDto) {
    if (dto.schedulingType === ScheduleCreationType.STREAM) {
      // Map unified DTO → CreateStreamSlotDto
      const streamDto: CreateStreamSlotDto = {
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotDuration: dto.slotDuration!,
        bufferTime: dto.bufferTime,
      };
      return this.createStreamSlot(doctorUserId, streamDto);
    } else if (dto.schedulingType === ScheduleCreationType.WAVE) {
      // Map unified DTO → CreateWaveScheduleDto
      const waveDto: CreateWaveScheduleDto = {
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        capacity: dto.maxCapacity!,
      };
      return this.createWaveSchedule(doctorUserId, waveDto);
    } else {
      throw new BadRequestException(
        'schedulingType must be STREAM or WAVE.',
      );
    }
  }

  /**
   * Doctor creates a wave scheduling window with a capacity limit.
   */
  async createWaveSchedule(doctorUserId: number, dto: CreateWaveScheduleDto) {
    const doctorProfile = await this.getDoctorProfileByUserId(doctorUserId);

    this.validateFutureDateTime(dto.date, dto.startTime);
    this.validateTimeOrder(dto.startTime, dto.endTime);

    const wave = this.waveScheduleRepo.create({
      doctorId: doctorProfile.id,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      capacity: dto.capacity,
      bookedCount: 0,
    });

    const saved = await this.waveScheduleRepo.save(wave);

    return {
      message: 'Wave schedule created successfully',
      wave: saved,
    };
  }

  /**
   * Returns all stream slots for a specific doctor.
   * Optionally filter by availability.
   */
  async getStreamSlotsByDoctor(doctorId: number, onlyAvailable = false) {
    const today = new Date().toISOString().split('T')[0];

    const where: any = { doctorId, date: MoreThan(today) as any };
    if (onlyAvailable) {
      where.isAvailable = true;
      where.isBooked = false;
    }

    const slots = await this.streamSlotRepo.find({
      where,
      order: { date: 'ASC', startTime: 'ASC' },
    });

    return {
      message: slots.length
        ? 'Stream slots fetched successfully'
        : 'No stream slots found for this doctor.',
      slots,
    };
  }

  /**
   * Returns all wave schedules for a specific doctor.
   */
  async getWaveSchedulesByDoctor(doctorId: number, onlyAvailable = false) {
    const today = new Date().toISOString().split('T')[0];

    const waves = await this.waveScheduleRepo
      .createQueryBuilder('wave')
      .where('wave.doctorId = :doctorId', { doctorId })
      .andWhere('wave.date > :today', { today })
      .orderBy('wave.date', 'ASC')
      .addOrderBy('wave.startTime', 'ASC')
      .getMany();

    const result = onlyAvailable
      ? waves.filter((w) => w.bookedCount < w.capacity)
      : waves;

    return {
      message: result.length
        ? 'Wave schedules fetched successfully'
        : 'No wave schedules found for this doctor.',
      waves: result.map((w) => ({
        ...w,
        availableCapacity: w.capacity - w.bookedCount,
        isFull: w.bookedCount >= w.capacity,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Patient: Book Appointment ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  async bookAppointment(patientUserId: number, dto: BookAppointmentDto) {
    const patientProfile = await this.getPatientProfileByUserId(patientUserId);

    // Verify doctor exists
    const doctor = await this.doctorProfileRepo.findOne({
      where: { id: dto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${dto.doctorId} not found.`);
    }
    if (!doctor.isAvailable) {
      throw new BadRequestException(
        `Dr. ${doctor.fullName} is currently not accepting appointments.`,
      );
    }

    if (dto.schedulingType === SchedulingType.STREAM) {
      return this.bookStreamAppointment(patientProfile, doctor, dto);
    } else if (dto.schedulingType === SchedulingType.WAVE) {
      return this.bookWaveAppointment(patientProfile, doctor, dto);
    } else {
      throw new BadRequestException(
        `Invalid scheduling type. Must be STREAM or WAVE.`,
      );
    }
  }

  private async bookStreamAppointment(
    patient: PatientProfile,
    doctor: DoctorProfile,
    dto: BookAppointmentDto,
  ) {
    if (!dto.streamSlotId) {
      throw new BadRequestException(
        'streamSlotId is required for STREAM scheduling.',
      );
    }

    const slot = await this.streamSlotRepo.findOne({
      where: { id: dto.streamSlotId },
    });

    if (!slot) {
      throw new NotFoundException(
        `Stream slot with ID ${dto.streamSlotId} not found.`,
      );
    }
    if (slot.doctorId !== doctor.id) {
      throw new BadRequestException(
        'This stream slot does not belong to the specified doctor.',
      );
    }
    if (!slot.isAvailable) {
      const suggestion = await this.suggestNextStreamSlot(
        doctor.id,
        slot.date,
        slot.startTime,
      );
      throw new ConflictException({
        message: 'This slot is not available.',
        suggestion,
      });
    }
    if (slot.isBooked) {
      const suggestion = await this.suggestNextStreamSlot(
        doctor.id,
        slot.date,
        slot.startTime,
      );
      throw new ConflictException({
        message: 'This slot is already booked.',
        suggestion,
      });
    }

    this.validateFutureDateTime(slot.date, slot.startTime);

    // Check duplicate booking — patient can't book same doctor & slot twice
    const existing = await this.appointmentRepo.findOne({
      where: {
        patientId: patient.id,
        streamSlotId: slot.id,
        status: AppointmentStatus.CONFIRMED,
      },
    });
    if (existing) {
      throw new ConflictException(
        'You already have a confirmed booking for this slot.',
      );
    }

    // ── Atomic transaction ──────────────────────────────────────────────────
    return this.dataSource.transaction(async (manager) => {
      // Lock the slot row to prevent race conditions
      const lockedSlot = await manager
        .createQueryBuilder(StreamSlot, 'slot')
        .setLock('pessimistic_write')
        .where('slot.id = :id', { id: slot.id })
        .getOne();

      if (!lockedSlot || lockedSlot.isBooked || !lockedSlot.isAvailable) {
        const suggestion = await this.suggestNextStreamSlot(
          doctor.id,
          slot.date,
          slot.startTime,
        );
        throw new ConflictException({
          message: 'Slot was just booked by another patient.',
          suggestion,
        });
      }

      // Reserve the slot
      lockedSlot.isBooked = true;
      await manager.save(StreamSlot, lockedSlot);

      // Create appointment record
      const appointment = manager.create(Appointment, {
        patientId: patient.id,
        doctorId: doctor.id,
        schedulingType: SchedulingType.STREAM,
        streamSlotId: slot.id,
        waveScheduleId: null,
        waveToken: null,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: AppointmentStatus.CONFIRMED,
        notes: dto.notes ?? null,
      });

      const saved = await manager.save(Appointment, appointment);

      return {
        message: 'Appointment booked successfully (Stream)',
        appointment: saved,
      };
    });
  }

  private async bookWaveAppointment(
    patient: PatientProfile,
    doctor: DoctorProfile,
    dto: BookAppointmentDto,
  ) {
    if (!dto.waveScheduleId) {
      throw new BadRequestException(
        'waveScheduleId is required for WAVE scheduling.',
      );
    }

    const wave = await this.waveScheduleRepo.findOne({
      where: { id: dto.waveScheduleId },
    });

    if (!wave) {
      throw new NotFoundException(
        `Wave schedule with ID ${dto.waveScheduleId} not found.`,
      );
    }
    if (wave.doctorId !== doctor.id) {
      throw new BadRequestException(
        'This wave schedule does not belong to the specified doctor.',
      );
    }

    this.validateFutureDateTime(wave.date, wave.startTime);

    if (wave.bookedCount >= wave.capacity) {
      const suggestion = await this.suggestNextWaveSchedule(
        doctor.id,
        wave.date,
      );
      throw new ConflictException({
        message: 'This wave is full.',
        suggestion,
      });
    }

    // Prevent duplicate booking in same wave
    const existing = await this.appointmentRepo.findOne({
      where: {
        patientId: patient.id,
        waveScheduleId: wave.id,
        status: AppointmentStatus.CONFIRMED,
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
    if (appointment.patientId !== patientProfile.id) {

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
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('This appointment is already cancelled.');
    }

    // 30-minute cutoff
    this.validateCutoffRule(appointment.appointmentDate, appointment.startTime);

    return this.dataSource.transaction(async (manager) => {
      // Release stream slot if applicable
      if (
        appointment.schedulingType === SchedulingType.STREAM &&
        appointment.streamSlotId
      ) {
        await manager.update(
          StreamSlot,
          { id: appointment.streamSlotId },
          { isBooked: false },
        );
      }

      // Decrement wave count if applicable
      if (
        appointment.schedulingType === SchedulingType.WAVE &&
        appointment.waveScheduleId
      ) {
        const wave = await manager
          .createQueryBuilder(WaveSchedule, 'wave')
          .setLock('pessimistic_write')
          .where('wave.id = :id', { id: appointment.waveScheduleId })
          .getOne();

        if (wave && wave.bookedCount > 0) {
          wave.bookedCount -= 1;
          await manager.save(WaveSchedule, wave);
        }
      }

      appointment.status = AppointmentStatus.CANCELLED;
      const updated = await manager.save(Appointment, appointment);

      return {
        message: 'Appointment cancelled successfully.',
        appointment: updated,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Patient: View Appointments ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  async getMyAppointments(patientUserId: number) {
    const patientProfile = await this.getPatientProfileByUserId(patientUserId);

    const appointments = await this.appointmentRepo.find({
      where: { patientId: patientProfile.id },
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });

    return {
      message:
        appointments.length > 0
          ? 'Appointments fetched successfully'
          : 'You have no appointments.',
      appointments,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Doctor: View Appointments ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  async getDoctorAppointments(doctorUserId: number) {
    const doctorProfile = await this.getDoctorProfileByUserId(doctorUserId);

    const appointments = await this.appointmentRepo.find({
      where: { doctorId: doctorProfile.id },
      order: { appointmentDate: 'ASC', startTime: 'ASC' },
    });

    return {
      message:
        appointments.length > 0
          ? 'Appointments fetched successfully'
          : 'No appointments found.',
      appointments,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── "Suggest Next" Helpers ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Finds the next available (not booked, isAvailable) stream slot for a doctor
   * after the given date+time. Returns null if none exists.
   */
  async suggestNextStreamSlot(
    doctorId: number,
    fromDate: string,
    fromTime: string,
  ) {
    const now = new Date().toISOString().split('T')[0];

    const slot = await this.streamSlotRepo
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.isAvailable = true')
      .andWhere('slot.isBooked = false')
      .andWhere(
        // After from date, or same date but later time
        `(slot.date > :fromDate OR (slot.date = :fromDate AND slot.startTime > :fromTime))`,
        { fromDate, fromTime },
      )
      .andWhere('slot.date >= :now', { now })
      .orderBy('slot.date', 'ASC')
      .addOrderBy('slot.startTime', 'ASC')
      .getOne();

    if (!slot) {
      return null;
    }

    return {
      message: 'Next available slot suggested',
      slot: {
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    };
  }

  /**
   * Finds the next available (not full) wave schedule for a doctor
   * after the given date. Returns null if none exists.
   */
  async suggestNextWaveSchedule(doctorId: number, fromDate: string) {
    const now = new Date().toISOString().split('T')[0];

    const wave = await this.waveScheduleRepo
      .createQueryBuilder('wave')
      .where('wave.doctorId = :doctorId', { doctorId })
      .andWhere('wave.date > :fromDate', { fromDate })
      .andWhere('wave.date >= :now', { now })
      .andWhere('wave.bookedCount < wave.capacity')
      .orderBy('wave.date', 'ASC')
      .addOrderBy('wave.startTime', 'ASC')
      .getOne();

    if (!wave) {
      return null;
    }

    return {
      message: 'Next available wave suggested',
      wave: {
        id: wave.id,
        date: wave.date,
        startTime: wave.startTime,
        endTime: wave.endTime,
        availableCapacity: wave.capacity - wave.bookedCount,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Private Helpers ─────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private async getDoctorProfileByUserId(userId: number): Promise<DoctorProfile> {
    const profile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(
        'Doctor profile not found. Please complete onboarding first.',
      );
    }
    return profile;
  }

  private async getPatientProfileByUserId(userId: number): Promise<PatientProfile> {
    const profile = await this.patientProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(
        'Patient profile not found. Please complete onboarding first.',
      );
    }
    return profile;
  }

  /**
   * Validates that a given date+time is in the future.
   */
  private validateFutureDateTime(date: string, time: string): void {
    const slotDateTime = new Date(`${date}T${time}:00`);
    const now = new Date();

    if (slotDateTime <= now) {
      throw new BadRequestException(
        `Cannot book or reschedule to a past date/time (${date} ${time}).`,
      );
    }
  }

  /**
   * Validates that startTime < endTime.
   */
  private validateTimeOrder(startTime: string, endTime: string): void {
    if (startTime >= endTime) {
      throw new BadRequestException(
        'Start time must be before end time.',
      );
    }
  }

  /**
   * Rule 1: Patients cannot cancel or reschedule if less than 30 minutes remain
   * before the appointment start time.
   */
  private validateCutoffRule(appointmentDate: string, startTime: string): void {
    const appointmentStart = new Date(`${appointmentDate}T${startTime}:00`);
    const now = new Date();
    const diffMs = appointmentStart.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    if (diffMinutes < CUTOFF_MINUTES) {
      throw new BadRequestException(
        `Cannot cancel or reschedule within ${CUTOFF_MINUTES} minutes of the appointment start time. ` +
          `Your appointment starts at ${startTime} on ${appointmentDate}.`,
      );
    }
  }
}
