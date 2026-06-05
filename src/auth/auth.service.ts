import { ConflictException, Injectable } from '@nestjs/common';
import { SignupDto } from './signup.dto';
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
}
