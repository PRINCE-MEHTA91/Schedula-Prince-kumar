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

@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // POST /appointment — Book a new appointment (PATIENT only)
  @Post()
  @Roles(Role.PATIENT)
  async bookAppointment(@Request() req: any, @Body() dto: BookAppointmentDto) {
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
    return this.appointmentService.rescheduleAppointment(
      id,
      patientUserId,
      dto,
    );
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

  // GET /appointment/available-slots — Get available slots for a doctor on a specific date
  @Get('available-slots')
  @Roles(Role.PATIENT)
  async getAvailableSlots(
    @Query('doctorId', ParseIntPipe) doctorId: number,
    @Query('date') date: string,
  ) {
    try {
      return await this.appointmentService.getAvailableSlots(doctorId, date);
    } catch (error) {
      console.error(error);
      return { statusCode: 500, message: error.message, stack: error.stack };
    }
  }
  // GET /appointment/next-available — Get the next available slot for a doctor
  @Get('next-available')
  @Roles(Role.PATIENT)
  async getNextAvailableSlots(
    @Query('doctorId', ParseIntPipe) doctorId: number,
    @Query('date') date: string,
  ) {
    try {
      // Use today's date if date is not provided
      const startDate = date || new Date().toISOString().split('T')[0];
      return await this.appointmentService.getNextAvailableSlots(doctorId, startDate);
    } catch (error) {
      console.error(error);
      return { statusCode: 500, message: error.message, stack: error.stack };
    }
  }
}
