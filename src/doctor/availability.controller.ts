import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Request, ValidationPipe } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { Public } from '../auth/public.decorator';

@Controller('doctor')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  /**
   * POST /doctor/availability
   * Create recurring availability for the authenticated doctor.
   */
  @Post('availability')
  @Roles(Role.DOCTOR)
  async createRecurringAvailability(
    @Request() req: any,
    @Body(new ValidationPipe()) createRecurringAvailabilityDto: CreateRecurringAvailabilityDto,
  ) {
    const userId = req.user.id;
    return this.availabilityService.createRecurringAvailability(userId, createRecurringAvailabilityDto);
  }

  /**
   * POST /doctor/availability/override
   * Create custom availability override for the authenticated doctor.
   */
  @Post('availability/override')
  @Roles(Role.DOCTOR)
  async createCustomAvailability(
    @Request() req: any,
    @Body(new ValidationPipe()) createCustomAvailabilityDto: CreateCustomAvailabilityDto,
  ) {
    const userId = req.user.id;
    return this.availabilityService.createCustomAvailability(userId, createCustomAvailabilityDto);
  }

  /**
   * GET /doctor/:doctorId/slots?date=YYYY-MM-DD
   * Fetch available slots for a doctor on a specific date.
   * Public — no auth required (patients can browse without logging in).
   */
  @Get(':doctorId/slots')
  @Public()
  async getAvailableSlots(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query(new ValidationPipe({ transform: true })) query: GetSlotsQueryDto,
  ) {
    return this.availabilityService.getAvailableSlots(doctorId, query.date);
  }
}

