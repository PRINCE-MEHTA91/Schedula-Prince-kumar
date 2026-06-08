import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('doctor')
@Roles(Role.DOCTOR) // All routes in this controller require DOCTOR role
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  // POST /doctor/profile — Create doctor profile (Doctor only)
  @Post('profile')
  async createProfile(
    @Request() req: any,
    @Body() createDoctorProfileDto: CreateDoctorProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.doctorService.createProfile(userId, createDoctorProfileDto);
  }

  // GET /doctor/profile — Get doctor profile (Doctor only)
  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId: number = req.user.id;
    return this.doctorService.getProfile(userId);
  }

  // PATCH /doctor/profile — Update doctor profile (Doctor only)
  @Patch('profile')
  async updateProfile(
    @Request() req: any,
    @Body() updateDoctorProfileDto: UpdateDoctorProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.doctorService.updateProfile(userId, updateDoctorProfileDto);
  }
}
