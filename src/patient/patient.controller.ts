import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PatientService } from './patient.service';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('patient')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PATIENT) // All routes in this controller require PATIENT role
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // POST /patient/profile — Create patient profile (Patient only)
  @Post('profile')
  async createProfile(
    @Request() req: any,
    @Body() createPatientProfileDto: CreatePatientProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.patientService.createProfile(userId, createPatientProfileDto);
  }

  // GET /patient/profile — Get patient profile (Patient only)
  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId: number = req.user.id;
    return this.patientService.getProfile(userId);
  }

  // PATCH /patient/profile — Update patient profile (Patient only)
  @Patch('profile')
  async updateProfile(
    @Request() req: any,
    @Body() updatePatientProfileDto: UpdatePatientProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.patientService.updateProfile(userId, updatePatientProfileDto);
  }
}
