import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './signup.dto';
import { LoginDto } from './login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from './role.enum';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/signup — public route (no token required)
  @Public()
  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  // POST /auth/login — public route (no token required)
  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // GET /auth/profile  — protected route (any authenticated user)
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return {
      message: 'Profile fetched successfully',
      user: req.user,
    };
  }

  // GET /auth/doctor-only  — protected route (DOCTOR role only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @Get('doctor-only')
  doctorOnly(@Request() req: any) {
    return {
      message: 'Welcome Doctor!',
      user: req.user,
    };
  }

  // GET /auth/patient-only  — protected route (PATIENT role only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @Get('patient-only')
  patientOnly(@Request() req: any) {
    return {
      message: 'Welcome Patient!',
      user: req.user,
    };
  }
}
