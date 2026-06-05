import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './signup.dto';
import { LoginDto } from './login.dto';
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

  constructor(private readonly jwtService: JwtService) {}

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

    // Generate JWT token
    const token = this.generateToken(newUser);

    // Return success response without password
    const { password: _, ...userWithoutPassword } = newUser;

    return {
      message: 'User registered successfully',
      user: userWithoutPassword,
      access_token: token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = this.users.find((u) => u.email === email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password!);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    // Return response without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      message: 'Login successful',
      user: userWithoutPassword,
      access_token: token,
    };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }
}
