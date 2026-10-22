import { Actor } from '@shared/auth/Actor';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '@shared/errors/AppError';
import { Role } from '@domain/aggregates/RoleAggregate/Role';
import { TenantUserReadModel } from '@infrastructure/queries/abstraction/ITenantUserQueries';
import { assertHoldsAll } from '@application/common/Authorization';

export const userNotFound = (): NotFoundError => new NotFoundError('User not found.');

export const forbiddenOperation = (message: string): ForbiddenError =>
  new ForbiddenError('FORBIDDEN_OPERATION', message);

/** The owner is untouchable; nobody manages someone with more access than their own. */
export function assertCanManage(actor: Actor, target: TenantUserReadModel): void {
  if (target.isOwner) throw forbiddenOperation('The company owner cannot be changed here.');
  assertHoldsAll(
    actor,
    target.permissions,
    'You cannot manage a user who has permissions you do not have.',
  );
}

/**
 * Roles being assigned: all must be active roles of this company (422 on roleIds), none may be the
 * built-in owner role, and none may grant more than the caller holds.
 */
export function assertAssignable(
  actor: Actor,
  requestedIds: readonly string[],
  found: readonly Role[],
): void {
  const unique = new Set(requestedIds);
  if (unique.size === 0)
    throw ValidationFailedError.forField('roleIds', 'Choose at least one role.');
  if (found.length !== unique.size) {
    throw ValidationFailedError.forField('roleIds', 'One or more roles do not exist.');
  }
  found.forEach((role) => role.assertEditable());
  assertHoldsAll(
    actor,
    found.flatMap((role) => role.permissions),
  );
}
