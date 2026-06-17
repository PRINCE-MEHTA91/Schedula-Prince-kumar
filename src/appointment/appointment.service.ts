import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
  SchedulingType,
} from './entities/appointment.entity';
import { StreamSlot } from './entities/stream-slot.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CreateStreamSlotDto } from './dto/create-stream-slot.dto';
import { CreateWaveScheduleDto } from './dto/create-wave-schedule.dto';
import {
  CreateScheduleDto,
  ScheduleCreationType,
} from './dto/create-schedule.dto';

/** Cutoff: cannot cancel/reschedule within 30 minutes of appointment start. */
const CUTOFF_MINUTES = 30;

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
        'You already have a confirmed booking in this wave.',
      );
    }

    // ── Atomic transaction ──────────────────────────────────────────────────
    return this.dataSource.transaction(async (manager) => {
      const lockedWave = await manager
        .createQueryBuilder(WaveSchedule, 'wave')
        .setLock('pessimistic_write')
        .where('wave.id = :id', { id: wave.id })
        .getOne();

      if (!lockedWave || lockedWave.bookedCount >= lockedWave.capacity) {
        const suggestion = await this.suggestNextWaveSchedule(
          doctor.id,
          wave.date,
        );
        throw new ConflictException({
          message: 'Wave just became full.',
          suggestion,
        });
      }

      const token = lockedWave.bookedCount + 1;
      lockedWave.bookedCount += 1;
      await manager.save(WaveSchedule, lockedWave);

      const appointment = manager.create(Appointment, {
        patientId: patient.id,
        doctorId: doctor.id,
        schedulingType: SchedulingType.WAVE,
        streamSlotId: null,
        waveScheduleId: wave.id,
        waveToken: token,
        appointmentDate: wave.date,
        startTime: wave.startTime,
        endTime: wave.endTime,
        status: AppointmentStatus.CONFIRMED,
        notes: dto.notes ?? null,
      });

      const saved = await manager.save(Appointment, appointment);

      return {
        message: 'Appointment booked successfully (Wave)',
        appointment: saved,
        waveToken: token,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Patient: Reschedule Appointment ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  async rescheduleAppointment(
    patientUserId: number,
    appointmentId: number,
    dto: RescheduleAppointmentDto,
  ) {
    const patientProfile = await this.getPatientProfileByUserId(patientUserId);

    // ── 1. Fetch appointment ────────────────────────────────────────────────
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found.`,
      );
    }

    // ── 2. Ownership check ──────────────────────────────────────────────────
    if (appointment.patientId !== patientProfile.id) {
      throw new ForbiddenException(
        'You are not authorized to reschedule this appointment.',
      );
    }

    // ── 3. Status check ─────────────────────────────────────────────────────
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot reschedule a cancelled appointment.',
      );
    }
    if (appointment.status === AppointmentStatus.RESCHEDULED) {
      throw new BadRequestException(
        'This appointment has already been rescheduled. Please use the new appointment ID.',
      );
    }

    // ── 4. 30-minute cutoff check ───────────────────────────────────────────
    this.validateCutoffRule(appointment.appointmentDate, appointment.startTime);

    // ── 5. Route by scheduling type ─────────────────────────────────────────
    if (appointment.schedulingType === SchedulingType.STREAM) {
      return this.rescheduleStreamAppointment(appointment, dto);
    } else {
      return this.rescheduleWaveAppointment(appointment, dto);
    }
  }

  private async rescheduleStreamAppointment(
    appointment: Appointment,
    dto: RescheduleAppointmentDto,
  ) {
    if (!dto.newStreamSlotId) {
      throw new BadRequestException(
        'newStreamSlotId is required to reschedule a STREAM appointment.',
      );
    }

    // ── Same slot check ─────────────────────────────────────────────────────
    if (appointment.streamSlotId === dto.newStreamSlotId) {
      throw new BadRequestException(
        'New slot is the same as the current slot. Please choose a different time.',
      );
    }

    // ── Validate new slot ───────────────────────────────────────────────────
    const newSlot = await this.streamSlotRepo.findOne({
      where: { id: dto.newStreamSlotId },
    });

    if (!newSlot) {
      throw new NotFoundException(
        `Stream slot with ID ${dto.newStreamSlotId} not found.`,
      );
    }
    if (newSlot.doctorId !== appointment.doctorId) {
      throw new BadRequestException(
        'New slot must belong to the same doctor.',
      );
    }

    if (!newSlot.isAvailable || newSlot.isBooked) {
      const suggestion = await this.suggestNextStreamSlot(
        appointment.doctorId,
        newSlot.date,
        newSlot.startTime,
      );
      throw new ConflictException({
        message: newSlot.isBooked
          ? 'Requested slot is already booked.'
          : 'Requested slot is not available.',
        suggestion,
      });
    }

    this.validateFutureDateTime(newSlot.date, newSlot.startTime);

    // ── Atomic transaction: release old, reserve new ────────────────────────
    return this.dataSource.transaction(async (manager) => {
      // Lock both slots
      const lockedOldSlot = appointment.streamSlotId
        ? await manager
            .createQueryBuilder(StreamSlot, 'slot')
            .setLock('pessimistic_write')
            .where('slot.id = :id', { id: appointment.streamSlotId })
            .getOne()
        : null;

      const lockedNewSlot = await manager
        .createQueryBuilder(StreamSlot, 'slot')
        .setLock('pessimistic_write')
        .where('slot.id = :id', { id: dto.newStreamSlotId })
        .getOne();

      if (!lockedNewSlot || lockedNewSlot.isBooked || !lockedNewSlot.isAvailable) {
        const suggestion = await this.suggestNextStreamSlot(
          appointment.doctorId,
          newSlot.date,
          newSlot.startTime,
        );
        throw new ConflictException({
          message: 'New slot was just taken by another patient.',
          suggestion,
        });
      }

      // Release old slot
      if (lockedOldSlot) {
        lockedOldSlot.isBooked = false;
        await manager.save(StreamSlot, lockedOldSlot);
      }

      // Reserve new slot
      lockedNewSlot.isBooked = true;
      await manager.save(StreamSlot, lockedNewSlot);

      // Update appointment record
      appointment.streamSlotId = lockedNewSlot.id;
      appointment.appointmentDate = lockedNewSlot.date;
      appointment.startTime = lockedNewSlot.startTime;
      appointment.endTime = lockedNewSlot.endTime;
      appointment.status = AppointmentStatus.CONFIRMED;

      const updated = await manager.save(Appointment, appointment);

      return {
        message: 'Appointment rescheduled successfully (Stream)',
        appointment: updated,
      };
    });
  }

  private async rescheduleWaveAppointment(
    appointment: Appointment,
    dto: RescheduleAppointmentDto,
  ) {
    if (!dto.newWaveScheduleId) {
      throw new BadRequestException(
        'newWaveScheduleId is required to reschedule a WAVE appointment.',
      );
    }

    // ── Same wave check ─────────────────────────────────────────────────────
    if (appointment.waveScheduleId === dto.newWaveScheduleId) {
      throw new BadRequestException(
        'New wave is the same as the current wave. Please choose a different time.',
      );
    }

    // ── Validate new wave ───────────────────────────────────────────────────
    const newWave = await this.waveScheduleRepo.findOne({
      where: { id: dto.newWaveScheduleId },
    });

    if (!newWave) {
      throw new NotFoundException(
        `Wave schedule with ID ${dto.newWaveScheduleId} not found.`,
      );
    }
    if (newWave.doctorId !== appointment.doctorId) {
      throw new BadRequestException(
        'New wave must belong to the same doctor.',
      );
    }
    if (newWave.bookedCount >= newWave.capacity) {
      const suggestion = await this.suggestNextWaveSchedule(
        appointment.doctorId,
        newWave.date,
      );
      throw new ConflictException({
        message: 'The requested wave is full.',
        suggestion,
      });
    }

    this.validateFutureDateTime(newWave.date, newWave.startTime);

    // ── Atomic transaction: release old wave seat, reserve new ──────────────
    return this.dataSource.transaction(async (manager) => {
      // Lock old wave
      const lockedOldWave = appointment.waveScheduleId
        ? await manager
            .createQueryBuilder(WaveSchedule, 'wave')
            .setLock('pessimistic_write')
            .where('wave.id = :id', { id: appointment.waveScheduleId })
            .getOne()
        : null;

      // Lock new wave
      const lockedNewWave = await manager
        .createQueryBuilder(WaveSchedule, 'wave')
        .setLock('pessimistic_write')
        .where('wave.id = :id', { id: dto.newWaveScheduleId })
        .getOne();

      if (!lockedNewWave || lockedNewWave.bookedCount >= lockedNewWave.capacity) {
        const suggestion = await this.suggestNextWaveSchedule(
          appointment.doctorId,
          newWave.date,
        );
        throw new ConflictException({
          message: 'New wave just became full.',
          suggestion,
        });
      }

      // Release old wave seat
      if (lockedOldWave && lockedOldWave.bookedCount > 0) {
        lockedOldWave.bookedCount -= 1;
        await manager.save(WaveSchedule, lockedOldWave);
      }

      // Reserve new wave seat and assign token
      const newToken = lockedNewWave.bookedCount + 1;
      lockedNewWave.bookedCount += 1;
      await manager.save(WaveSchedule, lockedNewWave);

      // Update appointment record
      appointment.waveScheduleId = lockedNewWave.id;
      appointment.waveToken = newToken;
      appointment.appointmentDate = lockedNewWave.date;
      appointment.startTime = lockedNewWave.startTime;
      appointment.endTime = lockedNewWave.endTime;
      appointment.status = AppointmentStatus.CONFIRMED;

      const updated = await manager.save(Appointment, appointment);

      return {
        message: 'Appointment rescheduled successfully (Wave)',
        appointment: updated,
        newWaveToken: newToken,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Patient: Cancel Appointment ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  async cancelAppointment(patientUserId: number, appointmentId: number) {
    const patientProfile = await this.getPatientProfileByUserId(patientUserId);

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found.`,
      );
    }
    if (appointment.patientId !== patientProfile.id) {
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
