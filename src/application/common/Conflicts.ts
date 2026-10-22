import { ConflictError } from '@shared/errors/AppError';

export const slugConflict = (): ConflictError =>
  new ConflictError('SLUG_CONFLICT', 'That slug is already in use.');

export const emailConflict = (): ConflictError =>
  new ConflictError('EMAIL_CONFLICT', 'That email is already registered.');
