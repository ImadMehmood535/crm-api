import { UserLevel } from '@shared/auth/UserLevel';
import { ForbiddenError } from '@shared/errors/AppError';

export { CREATABLE_LEVELS, USER_LEVELS, UserLevel } from '@shared/auth/UserLevel';

/** Who may create (or move people to) which level, by the creator's own level. */
const CREATABLE: Record<UserLevel, readonly UserLevel[]> = {
  owner: ['admin', 'department_head', 'member'],
  admin: ['department_head', 'member'],
  department_head: ['member'],
  member: [],
};

export function canCreateLevel(actorLevel: UserLevel, level: UserLevel): boolean {
  return CREATABLE[actorLevel].includes(level);
}

export function assertCanCreateLevel(actorLevel: UserLevel, level: UserLevel): void {
  if (!canCreateLevel(actorLevel, level)) {
    throw new ForbiddenError(
      'FORBIDDEN_OPERATION',
      `You cannot create or manage users at the ${level} level.`,
    );
  }
}
