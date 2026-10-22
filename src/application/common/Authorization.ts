import { Actor } from '@shared/auth/Actor';
import { ForbiddenError } from '@shared/errors/AppError';

const PLATFORM_SUPER_USER = 'platform_super_user';

export const permissionDenied = (
  message = 'You do not have permission to perform this action.',
): ForbiddenError => new ForbiddenError('PERMISSION_DENIED', message);

/** Platform console endpoints: Invespy operators only. */
export function requirePlatform(actor: Actor): void {
  if (actor.plane !== 'platform') throw permissionDenied('Platform access only.');
}

/** Managing platform admins: the platform super user only. */
export function requirePlatformSuperUser(actor: Actor): void {
  requirePlatform(actor);
  if (!actor.roles.includes(PLATFORM_SUPER_USER)) {
    throw permissionDenied('Only a platform super user can do this.');
  }
}
