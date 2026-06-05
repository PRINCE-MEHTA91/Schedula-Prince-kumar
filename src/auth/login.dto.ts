import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for user login.
 * Validates incoming request body fields using class-validator decorators.
 */
export class LoginDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  password: string;
}
