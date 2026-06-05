import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Authentication Guard.
 * Extends Passport's built-in 'jwt' AuthGuard.
 * Apply to any route that requires a valid JWT token.
 *
 * Usage: @UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Call the parent canActivate to validate the JWT token
    return super.canActivate(context);
  }
}
