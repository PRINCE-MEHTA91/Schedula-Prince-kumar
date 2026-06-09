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
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { Public } from '../auth/public.decorator';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  // --- PUBLIC ROUTES (bina login ke) ---

  // GET /doctor — saare doctors ki list, optional filters ke saath
  @Public()
  @Get()
  async getAllDoctors(@Query() query: GetDoctorsQueryDto) {
    return this.doctorService.findAll(query);
  }

  // GET /doctor/:id — ek doctor ka full profile ID se
  @Public()
  @Get(':id')
  async getDoctorById(
    @Param('id', ParseIntPipe) id: number, // valid number ensure karta hai
  ) {
    return this.doctorService.findById(id);
  }

  // --- DOCTOR-ONLY ROUTES (login + DOCTOR role zaroori) ---

  // POST /doctor/profile — doctor apna profile banata hai
  @Roles(Role.DOCTOR)
  @Post('profile')
  async createProfile(
    @Request() req: any,
    @Body() createDoctorProfileDto: CreateDoctorProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.doctorService.createProfile(userId, createDoctorProfileDto);
  }

  // GET /doctor/profile — doctor apna khud ka profile dekhta hai
  // NOTE: :id se pehle hona chahiye warna "profile" ID samajh leta hai
  @Roles(Role.DOCTOR)
  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId: number = req.user.id;
    return this.doctorService.getProfile(userId);
  }

  // PATCH /doctor/profile — doctor apna profile update karta hai
  @Roles(Role.DOCTOR)
  @Patch('profile')
  async updateProfile(
    @Request() req: any,
    @Body() updateDoctorProfileDto: UpdateDoctorProfileDto,
  ) {
    const userId: number = req.user.id;
    return this.doctorService.updateProfile(userId, updateDoctorProfileDto);
  }
}
