import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { Role } from './role.enum';

/**
 * DTO for user registration (signup).
 * Validates incoming request body fields using class-validator decorators.
 */
export class SignupDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(Role, { message: 'Role must be either DOCTOR or PATIENT' })
  role: Role;
}
