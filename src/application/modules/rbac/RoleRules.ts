import { ConflictError, NotFoundError, ValidationFailedError } from '@shared/errors/AppError';

export const roleNotFound = (): NotFoundError => new NotFoundError('Role not found.');

export const roleNameConflict = (): ConflictError =>
  new ConflictError('ROLE_NAME_CONFLICT', 'A role with this name already exists.');

/** Every requested code must exist in the catalogue (422 on `permissions` otherwise). */
export function assertKnownCodes(codes: readonly string[], catalogue: readonly string[]): void {
  const unknown = codes.filter((code) => !catalogue.includes(code));
  if (unknown.length > 0) {
    throw ValidationFailedError.forField(
      'permissions',
      `Unknown permission(s): ${unknown.join(', ')}.`,
    );
  }
}
