import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('appointments')
@Roles(Role.PATIENT)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /**
   * POST /appointments
   * Book a slot — Patient only.
   * Body: { doctorId, date, startTime }
   */
  @Post()
  async bookAppointment(
    @Request() req: any,
    @Body(new ValidationPipe()) dto: BookAppointmentDto,
  ) {
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }

  /**
   * DELETE /appointments/:id
   * Cancel an appointment — Patient only, must own the appointment.
   */
  @Delete(':id')
  async cancelAppointment(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentService.cancelAppointment(req.user.id, id);
  }

  /**
   * GET /appointments/my
   * Get all appointments for the logged-in patient.
   */
  @Get('my')
  async getMyAppointments(@Request() req: any) {
    return this.appointmentService.getMyAppointments(req.user.id);
  }
}
