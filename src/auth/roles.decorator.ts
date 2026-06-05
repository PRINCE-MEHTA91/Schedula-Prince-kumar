import { SetMetadata } from '@nestjs/common';
import { Role } from './role.enum';

/**
 * Metadata key used to store roles on route handlers.
 */
export const ROLES_KEY = 'roles';

/**
 * Custom decorator to assign allowed roles to a route.
 *
 * Usage:
 * @Roles(Role.DOCTOR)
 * @Roles(Role.PATIENT)
 * @Roles(Role.DOCTOR, Role.PATIENT)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
