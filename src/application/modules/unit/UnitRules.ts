import { ConflictError, NotFoundError } from '@shared/errors/AppError';

export const unitNotFound = (): NotFoundError => new NotFoundError('Unit not found.');

export const unitNumberConflict = (): ConflictError =>
  new ConflictError('UNIT_NUMBER_CONFLICT', 'This project already has a unit with this number.');
