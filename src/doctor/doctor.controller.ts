import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { Request } from 'express';

/**
 * DoctorController — handles all /doctor routes.
 * All routes are protected: they require a valid JWT AND the DOCTOR role.
 */
@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorController {
  /**
   * GET /doctor/profile
   *
   * Access:
   *  ✅ DOCTOR  → 200 OK with profile data
   *  ❌ PATIENT → 403 Forbidden
   *  ❌ No token → 401 Unauthorized
   */
  @Get('profile')
  @Roles(Role.DOCTOR)
  getProfile(@Req() req: Request & { user: any }) {
    return {
      message: 'Welcome, Doctor! You have successfully accessed the Doctor profile.',
      profile: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        specialization: 'General Physician',
        availableSlots: ['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'],
        department: 'Outpatient',
      },
    };
  }
}
