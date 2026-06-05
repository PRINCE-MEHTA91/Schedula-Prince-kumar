import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JWT_SECRET, JWT_EXPIRES_IN } from './auth.constants';

/**
 * AuthModule — bundles all auth-related providers, guards, and strategies.
 *
 * Exports:
 *  - JwtModule  →  allows other modules to use JwtService if needed
 *  - AuthService →  allows other modules to call auth methods if needed
 */
@Module({
  imports: [
    // Register Passport with the default strategy set to 'jwt'
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Register JwtModule with secret and expiry from constants
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: JWT_EXPIRES_IN },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy, // Passport will auto-discover and register this strategy
  ],
  exports: [
    JwtModule,    // Export so other modules can inject JwtService
    AuthService,  // Export so other modules can call auth methods
    PassportModule,
  ],
})
export class AuthModule {}
