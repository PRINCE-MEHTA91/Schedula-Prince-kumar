import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AvailabilityService } from './availability.service';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { GetAvailabilityDto } from './dto/get-availability.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

@Controller('doctor/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  @Roles(Role.DOCTOR)
  async createRecurring(
    @Request() req: any,
    @Body() dto: CreateRecurringAvailabilityDto,
  ) {
    return this.availabilityService.createRecurring(req.user.id, dto);
  }

  @Get()
  @Roles(Role.DOCTOR)
  async getRecurring(@Request() req: any) {
    return this.availabilityService.getRecurring(req.user.id);
  }

  @Patch(':id')
  @Roles(Role.DOCTOR)
  async updateRecurring(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecurringAvailabilityDto,
  ) {
    return this.availabilityService.updateRecurring(req.user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.DOCTOR)
  async deleteRecurring(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.availabilityService.deleteRecurring(req.user.id, id);
  }

  @Post('override')
  @Roles(Role.DOCTOR)
  async createCustomOverride(
    @Request() req: any,
    @Body() dto: CreateCustomAvailabilityDto,
  ) {
    return this.availabilityService.createCustomOverride(req.user.id, dto);
  }

  @Get('date')
  @Roles(Role.DOCTOR)
  async getAvailabilityByDate(
    @Request() req: any,
    @Query() query: GetAvailabilityDto,
  ) {
    return this.availabilityService.getAvailabilityByDate(req.user.id, query.date);
  }
}
