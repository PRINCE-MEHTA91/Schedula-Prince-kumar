import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CreateStreamSlotDto } from './dto/create-stream-slot.dto';
import { CreateWaveScheduleDto } from './dto/create-wave-schedule.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

/**
 * Appointment Controller
 *
 * Routes are split between PATIENT and DOCTOR roles.
 * The global JwtAuthGuard + RolesGuard are applied via app.module.ts.
 *
 * Patient Routes:
 *   POST   /appointment/book                          — Book an appointment
 *   PATCH  /appointment/:id/reschedule                — Reschedule
 *   PATCH  /appointment/:id/cancel                    — Cancel
 *   GET    /appointment/my                            — View my appointments
 *   GET    /appointment/stream-slots/:doctorId        — View doctor's stream slots
 *   GET    /appointment/wave-schedules/:doctorId      — View doctor's wave schedules
 *
 * Doctor Routes:
 *   POST   /appointment/stream-slot                   — Create a stream slot
 *   POST   /appointment/wave-schedule                 — Create a wave schedule
 *   GET    /appointment/my-schedule                   — View my appointments
 */
@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Patient Routes ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /appointment/book
   * Book a new appointment (Stream or Wave).
   */
  @Post('book')
  @Roles(Role.PATIENT)
  async bookAppointment(
    @Request() req: any,
    @Body() dto: BookAppointmentDto,
  ) {
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }

  /**
   * PATCH /appointment/:id/reschedule
   * Reschedule an existing appointment to a new slot or wave.
   */
  @Patch(':id/reschedule')
  @Roles(Role.PATIENT)
  async rescheduleAppointment(
    @Request() req: any,
    @Param('id', ParseIntPipe) appointmentId: number,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentService.rescheduleAppointment(
      req.user.id,
      appointmentId,
      dto,
    );
  }

  /**
   * PATCH /appointment/:id/cancel
   * Cancel an existing appointment.
   * Cannot cancel within 30 minutes of start time.
   */
  @Patch(':id/cancel')
  @Roles(Role.PATIENT)
  async cancelAppointment(
    @Request() req: any,
    @Param('id', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointmentService.cancelAppointment(
      req.user.id,
      appointmentId,
    );
  }

  /**
   * GET /appointment/my
   * View all appointments for the logged-in patient.
   */
  @Get('my')
  @Roles(Role.PATIENT)
  async getMyAppointments(@Request() req: any) {
    return this.appointmentService.getMyAppointments(req.user.id);
  }

  /**
   * GET /appointment/stream-slots/:doctorId
   * View all upcoming stream slots for a doctor.
   * Optional query: ?available=true — only show unbooked slots.
   */
  @Get('stream-slots/:doctorId')
  @Roles(Role.PATIENT)
  async getStreamSlots(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query('available') available?: string,
  ) {
    const onlyAvailable = available === 'true';
    return this.appointmentService.getStreamSlotsByDoctor(
      doctorId,
      onlyAvailable,
    );
  }

  /**
   * GET /appointment/wave-schedules/:doctorId
   * View all upcoming wave schedules for a doctor.
   * Optional query: ?available=true — only show waves with capacity.
   */
  @Get('wave-schedules/:doctorId')
  @Roles(Role.PATIENT)
  async getWaveSchedules(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query('available') available?: string,
  ) {
    const onlyAvailable = available === 'true';
    return this.appointmentService.getWaveSchedulesByDoctor(
      doctorId,
      onlyAvailable,
    );
  }

  /**
   * POST /appointment/schedule
   * Unified route — Doctor creates either a STREAM or WAVE schedule.
   *
   * STREAM body:
   * {
   *   "schedulingType": "STREAM",
   *   "date": "2026-07-01",
   *   "startTime": "10:00",
   *   "endTime": "11:00",
   *   "slotDuration": 15,
   *   "bufferTime": 5
   * }
   *
   * WAVE body:
   * {
   *   "schedulingType": "WAVE",
   *   "date": "2026-07-01",
   *   "startTime": "10:00",
   *   "endTime": "11:00",
   *   "maxCapacity": 5
   * }
   */
  @Post('schedule')
  @Roles(Role.DOCTOR)
  async createSchedule(
    @Request() req: any,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.appointmentService.createSchedule(req.user.id, dto);
  }

  /**
   * POST /appointment/stream-slot  (kept for backward compatibility)
   * Doctor creates stream slots from a time window.
   */
  @Post('stream-slot')
  @Roles(Role.DOCTOR)
  async createStreamSlot(
    @Request() req: any,
    @Body() dto: CreateStreamSlotDto,
  ) {
    return this.appointmentService.createStreamSlot(req.user.id, dto);
  }

  /**
   * POST /appointment/wave-schedule  (kept for backward compatibility)
   * Doctor creates a wave scheduling window.
   */
  @Post('wave-schedule')
  @Roles(Role.DOCTOR)
  async createWaveSchedule(
    @Request() req: any,
    @Body() dto: CreateWaveScheduleDto,
  ) {
    return this.appointmentService.createWaveSchedule(req.user.id, dto);
  }

  /**
   * GET /appointment/my-schedule
   * Doctor views all their appointments.
   */
  @Get('my-schedule')
  @Roles(Role.DOCTOR)
  async getDoctorAppointments(@Request() req: any) {
    return this.appointmentService.getDoctorAppointments(req.user.id);
  }
}
