import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationFailedError,
} from './AppError';

describe('AppError', () => {
  it('should carry 422 VALIDATION_FAILED and the field details', () => {
    const error = new ValidationFailedError([{ field: 'email', messages: ['Email is invalid.'] }]);

    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details).toEqual([{ field: 'email', messages: ['Email is invalid.'] }]);
    expect(error.name).toBe('ValidationFailedError');
  });

  it('should build a one-field validation error with the message as its text', () => {
    const error = ValidationFailedError.forField('name', 'Name is required.');

    expect(error.message).toBe('Name is required.');
    expect(error.details).toEqual([{ field: 'name', messages: ['Name is required.'] }]);
  });

  it.each([
    [new BadRequestError(), 400, 'BAD_REQUEST'],
    [new UnauthenticatedError(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenError('PERMISSION_DENIED', 'No.'), 403, 'PERMISSION_DENIED'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError('SLUG_CONFLICT', 'Taken.'), 409, 'SLUG_CONFLICT'],
  ])('should map %p to its status and code', (error, status, code) => {
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });
});
