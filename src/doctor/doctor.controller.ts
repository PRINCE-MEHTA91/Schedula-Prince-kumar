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
import { DoctorService } from './doctor.service';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';
import { AppointmentService } from '../appointment/appointment.service';
import { GetDoctorAppointmentsQueryDto } from './dto/get-doctor-appointments-query.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('doctor')
export class DoctorController {
 constructor(
  private readonly doctorService: DoctorService,
  private readonly appointmentService: AppointmentService,
) {}
  // ─── Doctor Discovery (public) ─────────────────────────────────────────────

  /**
   * GET /doctor
   * Fetch all doctors with optional filters (name, specialization, availability)
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
   * GET /doctor/availability — Doctor's own availability summary
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
   * GET /doctor/appointments — Doctor's assigned appointments
   */
  @Get('appointments')
  @Roles(Role.DOCTOR)
  async getDoctorAppointments(
    @Request() req: any,
    @Query() query: GetDoctorAppointmentsQueryDto,
  ) {
    const userId: number = req.user.id;
    return this.appointmentService.getDoctorAppointments(userId, query.date);
  }

  /**
   * PATCH /doctor/appointments/:id/cancel — Doctor cancels an appointment
   */
  @Patch('appointments/:id/cancel')
  @Roles(Role.DOCTOR)
  async cancelDoctorAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId: number = req.user.id;
    return this.appointmentService.cancelAppointmentByDoctor(id, userId);
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
