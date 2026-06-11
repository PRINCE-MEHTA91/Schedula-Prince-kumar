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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { DoctorService } from './doctor.service';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  // ─── Doctor Discovery (any authenticated user) ─────────────────────────────

  /**
   * GET /doctor
   * Fetch all doctors with optional filters:
   *   ?specialization=cardiologist
   *   ?search=rahul
   *   ?page=1&limit=10
   *   ?availability=true
   */
  @Get()
  async getDoctors(@Query() query: GetDoctorsQueryDto) {
    return this.doctorService.findAll(query);
  }

  /**
   * GET /doctor/:id
   * Fetch a single doctor's full profile by ID.
   */
  @Get(':id')
  async getDoctorById(@Param('id', ParseIntPipe) id: number) {
    return this.doctorService.findById(id);
  }

  // ─── Doctor Profile Management (DOCTOR role only) ──────────────────────────

  /**
   * POST /doctor/profile
   * Create the authenticated doctor's profile.
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
   * GET /doctor/profile
   * Get the authenticated doctor's own profile.
   */
  @Get('profile')
  @Roles(Role.DOCTOR)
  async getProfile(@Request() req: any) {
    const userId: number = req.user.id;
    return this.doctorService.getProfile(userId);
  }

  /**
   * PATCH /doctor/profile
   * Update the authenticated doctor's profile.
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
