import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { Request } from 'express';

/**
 * PatientController — handles all /patient routes.
 * All routes are protected: they require a valid JWT AND the PATIENT role.
 */
@Controller('patient')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientController {
  /**
   * GET /patient/profile
   *
   * Access:
   *  ✅ PATIENT → 200 OK with profile data
   *  ❌ DOCTOR  → 403 Forbidden
   *  ❌ No token → 401 Unauthorized
   */
  @Get('profile')
  @Roles(Role.PATIENT)
  getProfile(@Req() req: Request & { user: any }) {
    return {
      message: 'Welcome, Patient! You have successfully accessed the Patient profile.',
      profile: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        upcomingAppointments: [
          { date: '2026-06-10', time: '10:00 AM', doctor: 'Dr. Smith' },
          { date: '2026-06-15', time: '02:00 PM', doctor: 'Dr. Jane' },
        ],
        medicalHistory: 'No significant history recorded.',
      },
    };
  }
}
