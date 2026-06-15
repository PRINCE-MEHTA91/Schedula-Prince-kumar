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
  BadRequestException,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { AppointmentService } from '../appointment/appointment.service';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('doctor')
export class DoctorController {
  constructor(
    private readonly doctorService: DoctorService,
    private readonly appointmentService: AppointmentService,
  ) {}

  // ─── Doctor Discovery (any authenticated user) ─────────────────────────────

  /**
   * GET /doctor
   * Fetch all doctors with optional filters
   */
  @Get()
  async getDoctors(@Query() query: GetDoctorsQueryDto) {
    return this.doctorService.findAll(query);
  }

  // ─── Named routes MUST come before :id so NestJS matches them first ─────────

  /**
   * GET /doctor/profile — Doctor's own profile
   */
  @Get('profile')
  @Roles(Role.DOCTOR)
  async getProfile(@Request() req: any) {
    const userId: number = req.user.id;
    return this.doctorService.getProfile(userId);
  }

  /**
   * GET /doctor/appointments — Doctor views all their booked appointments
   */
  @Get('appointments')
  @Roles(Role.DOCTOR)
  async getMyAppointments(@Request() req: any) {
    const doctorUserId: number = req.user.id;
    return this.appointmentService.getDoctorAppointments(doctorUserId);
  }

  /**
   * GET /doctor/availability — Doctor's own availability
   */
  @Get('availability')
  @Roles(Role.DOCTOR)
  async getMyAvailability(@Request() req: any) {
    const userId: number = req.user.id;
    const { profile } = await this.doctorService.getProfile(userId);
    return {
      isAvailable: profile.isAvailable,
      availabilityHours: profile.availabilityHours,
    };
  }

  /**
   * GET /doctor/:id/slots — Fetch available slots for a doctor on a specific date
   */
  @Get(':id/slots')
  async getDoctorSlots(
    @Param('id', ParseIntPipe) id: number,
    @Query('date') date: string,
  ) {
    if (!date) {
      throw new BadRequestException('Date query parameter is required (YYYY-MM-DD).');
    }
    return this.appointmentService.getAvailableSlots(id, date);
  }

  /**
   * GET /doctor/:id — Public: get any doctor by ID
   * IMPORTANT: Keep this AFTER all named string routes above.
   */
  @Get(':id')
  async getDoctorById(@Param('id', ParseIntPipe) id: number) {
    return this.doctorService.findById(id);
  }

  // ─── Doctor Profile Management (DOCTOR role only) ──────────────────────────

  /**
   * POST /doctor/profile — Create doctor profile
   */
  @Post('profile')
  @Roles(Role.DOCTOR)
  async createProfile(
    @Request() req: any,
    @Body() createDoctorProfileDto: CreateDoctorProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.doctorService.createProfile(userId, createDoctorProfileDto);
  }

  /**
   * PATCH /doctor/profile — Update doctor profile
   */
  @Patch('profile')
  @Roles(Role.DOCTOR)
  async updateProfile(
    @Request() req: any,
    @Body() updateDoctorProfileDto: UpdateDoctorProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.doctorService.updateProfile(userId, updateDoctorProfileDto);
  }
}
