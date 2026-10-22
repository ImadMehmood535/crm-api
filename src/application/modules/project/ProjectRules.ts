import { ConflictError, NotFoundError } from '@shared/errors/AppError';

export const projectNotFound = (): NotFoundError => new NotFoundError('Project not found.');

export const projectNameConflict = (): ConflictError =>
  new ConflictError('PROJECT_NAME_CONFLICT', 'A project with this name already exists.');
