import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './signup.dto';
import { LoginDto } from './login.dto';

/**
 * AuthController — handles all /auth routes.
 *
 * POST /auth/signup  →  Register a new user (DOCTOR or PATIENT)
 * POST /auth/login   →  Authenticate and receive a JWT token
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Signup endpoint.
   * Validates the request body via SignupDto (class-validator).
   * Returns 201 Created with user details on success.
   * Returns 409 Conflict if the email is already registered.
   * Returns 400 Bad Request if validation fails.
   */
  @Post('signup')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  /**
   * Login endpoint.
   * Validates the request body via LoginDto (class-validator).
   * Returns 200 OK with a JWT access_token and user details on success.
   * Returns 401 Unauthorized if credentials are invalid.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
