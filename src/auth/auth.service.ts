import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { SignupDto } from './signup.dto';
import { LoginDto } from './login.dto';
import * as bcrypt from 'bcrypt';
import { Role } from './role.enum';

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: Role;
}

@Injectable()
export class AuthService {
  // In-memory array as temporary database storage
  private users: User[] = [];

  async signup(signupDto: SignupDto) {
    const { name, email, password, role } = signupDto;

    // Check if email already exists
    const existingUser = this.users.find((user) => user.email === email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash the password using bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user object
    const newUser: User = {
      id: this.users.length + 1,
      name,
      email,
      password: hashedPassword,
      role,
    };

    // Save to temporary database
    this.users.push(newUser);

    // Return success response without password
    const { password: _, ...userWithoutPassword } = newUser;

    return {
      message: 'User registered successfully',
      user: userWithoutPassword,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Check if user exists
    const user = this.users.find((u) => u.email === email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password against bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password!);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Return success response without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      message: 'Login successful',
      user: userWithoutPassword,
    };
  }
}
