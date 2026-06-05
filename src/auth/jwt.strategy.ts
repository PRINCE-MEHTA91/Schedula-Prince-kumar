import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from './auth.constants';

/**
 * JWT Payload interface — shape of the decoded token.
 */
export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

/**
 * Passport JWT Strategy.
 * Extracts the Bearer token from the Authorization header,
 * verifies it against JWT_SECRET, and attaches the payload to req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Extract token from "Authorization: Bearer <token>" header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Reject expired tokens
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  /**
   * Called automatically by Passport after the JWT signature is verified.
   * The returned value is attached to the request as `req.user`.
   */
  async validate(payload: JwtPayload) {
    if (!payload || !payload.userId) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  }
}
