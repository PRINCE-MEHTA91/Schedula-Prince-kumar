import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './role.enum';
import { ROLES_KEY } from './roles.decorator';

/**
 * Roles Guard — enforces role-based access control (RBAC).
 * Must be used AFTER JwtAuthGuard so that req.user is populated.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.DOCTOR)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Retrieve the roles required for this route (set by @Roles decorator)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles decorator is present, allow access (public-ish route)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Extract the authenticated user attached by JwtAuthGuard
    const { user } = context.switchToHttp().getRequest();

    // Check if the user's role is among the required roles
    const hasRole = requiredRoles.some((role) => role === user?.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}. Your role: ${user?.role}`,
      );
    }

    return true;
  }
}
