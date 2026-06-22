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
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Public } from '../auth/public.decorator';

@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  // GET /appointment/next-available?doctorId=3
  // Public — any authenticated or anonymous user can check availability
  @Get('next-available')
  @Public()
  async findNextAvailable(
    @Query('doctorId', ParseIntPipe) doctorId: number,
  ) {
    return this.appointmentService.findNextAvailable(doctorId);
  }

  // POST /appointment — Book a new appointment (PATIENT only)
  @Post()
  @Roles(Role.PATIENT)
  async bookAppointment(
    @Request() req: any,
    @Body() dto: BookAppointmentDto,
  ) {
    const patientUserId: number = req.user.id;
    return this.appointmentService.bookAppointment(patientUserId, dto);
  }

  // GET /appointment/my — Patient views their own appointments (PATIENT only)
  @Get('my')
  @Roles(Role.PATIENT)
  async getMyAppointments(@Request() req: any) {
    const patientUserId: number = req.user.id;
    return this.appointmentService.getMyAppointments(patientUserId);
  }

  // PATCH /appointment/:id — Patient reschedules their appointment (PATIENT only)
  @Patch(':id')
  @Roles(Role.PATIENT)
  async rescheduleAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: UpdateAppointmentDto,
  ) {
    const patientUserId: number = req.user.id;
    return this.appointmentService.rescheduleAppointment(id, patientUserId, dto);
  }

  // PATCH /appointment/:id/cancel — Patient cancels their appointment (PATIENT only)
  @Patch(':id/cancel')
  @Roles(Role.PATIENT)
  async cancelAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const patientUserId: number = req.user.id;
    return this.appointmentService.cancelAppointment(id, patientUserId);
  }
}
