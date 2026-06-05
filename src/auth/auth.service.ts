import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './signup.dto';
import { LoginDto } from './login.dto';
import { Role } from './role.enum';

/**
 * In-memory user entity shape.
 */
interface User {
  id: number;
  name: string;
  email: string;
  password: string; // hashed
  role: Role;
}

/**
 * AuthService handles all authentication business logic:
 * - User signup with password hashing and duplicate-email check
 * - User login with bcrypt comparison and JWT issuance
 */
@Injectable()
export class AuthService {
  // ───────────────────────────────────────────────
  // In-memory "database" — replaces a real DB for now
  // ───────────────────────────────────────────────
  private readonly users: User[] = [];
  private idCounter = 1;

  constructor(private readonly jwtService: JwtService) {}

  // ────────────────────────────────────────────────
  // SIGNUP
  // ────────────────────────────────────────────────

  /**
   * Registers a new user.
   * - Checks for duplicate email (throws 409 Conflict if found)
   * - Hashes password with bcrypt (10 salt rounds)
   * - Saves the user to the in-memory store
   * - Returns a sanitised user object (no password)
   */
  async signup(signupDto: SignupDto) {
    const { name, email, password, role } = signupDto;

    // Check for duplicate email
    const existingUser = this.users.find((u) => u.email === email);
    if (existingUser) {
      throw new ConflictException(
        `Email "${email}" is already registered. Please use a different email or login.`,
      );
    }

    // Hash the password (10 salt rounds is the OWASP-recommended minimum)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and persist user
    const newUser: User = {
      id: this.idCounter++,
      name,
      email,
      password: hashedPassword,
      role,
    };
    this.users.push(newUser);

    // Return success response (never expose the hashed password)
    return {
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  }

  // ────────────────────────────────────────────────
  // LOGIN
  // ────────────────────────────────────────────────

  /**
   * Authenticates a user.
   * - Looks up user by email (throws 401 if not found)
   * - Compares plain-text password against stored bcrypt hash
   * - Issues a signed JWT containing userId, email, and role
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find the user by email
    const user = this.users.find((u) => u.email === email);
    if (!user) {
      throw new UnauthorizedException(
        'Invalid credentials. No account found with this email.',
      );
    }

    // Compare password with stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Invalid credentials. The password you entered is incorrect.',
      );
    }

    // Build JWT payload
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Sign and return the JWT token
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
