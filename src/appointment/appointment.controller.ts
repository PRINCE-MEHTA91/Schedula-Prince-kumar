import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // ─── Doctor Routes (DOCTOR role only) ────────────────────────────────────────

  /**
   * POST /appointment/schedule
   * Doctor creates a STREAM or WAVE schedule for a specific date/window.
   *
   * STREAM body example:
   * {
   *   "schedulingType": "STREAM",
   *   "date": "2026-07-01",
   *   "startTime": "10:00",
   *   "endTime": "11:00",
   *   "slotDuration": 15,
   *   "bufferTime": 5
   * }
   *
   * WAVE body example:
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
    @Body() createScheduleDto: CreateScheduleDto,
  ) {
    return this.appointmentService.createSchedule(
      req.user.id,
      createScheduleDto,
    );
  }

  /**
   * GET /appointment/schedule
   * Doctor views all their own schedules with booking summaries.
   */
  @Get('schedule')
  @Roles(Role.DOCTOR)
  async getDoctorSchedules(@Request() req: any) {
    return this.appointmentService.getDoctorSchedules(req.user.id);
  }

  // ─── Patient Routes (PATIENT role only) ──────────────────────────────────────

  /**
   * GET /appointment/:scheduleId/slots
   * Patient fetches availability for a schedule.
   *
   * STREAM response: list of time slots with Available/Booked status.
   * WAVE response:   appointment window + remaining capacity count.
   */
  @Get(':scheduleId/slots')
  @Roles(Role.PATIENT)
  async getAvailability(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.appointmentService.getAvailability(scheduleId);
  }

  /**
   * POST /appointment/book
   * Patient books an appointment.
   *
   * STREAM body: { "scheduleId": 1, "slotId": 3 }
   * WAVE body:   { "scheduleId": 2 }   (slotId not needed — token auto-assigned)
   */
  @Post('book')
  @Roles(Role.PATIENT)
  async bookAppointment(
    @Request() req: any,
    @Body() bookAppointmentDto: BookAppointmentDto,
  ) {
    return this.appointmentService.bookAppointment(
      req.user.id,
      bookAppointmentDto,
    );
  }
}
