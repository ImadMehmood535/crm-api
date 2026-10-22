import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnauthenticatedError,
  UnsupportedMediaTypeError,
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

  it('should let a 422 carry a specific code and keep the field detail', () => {
    const error = ValidationFailedError.forField('slug', 'This slug is reserved.', 'SLUG_RESERVED');

    expect(error.status).toBe(422);
    expect(error.code).toBe('SLUG_RESERVED');
    expect(error.details).toEqual([{ field: 'slug', messages: ['This slug is reserved.'] }]);
  });

  it.each([
    [new BadRequestError(), 400, 'BAD_REQUEST'],
    [new UnauthenticatedError(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenError('PERMISSION_DENIED', 'No.'), 403, 'PERMISSION_DENIED'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError('SLUG_CONFLICT', 'Taken.'), 409, 'SLUG_CONFLICT'],
    [new PayloadTooLargeError('Big.'), 413, 'PAYLOAD_TOO_LARGE'],
    [new UnsupportedMediaTypeError('No.'), 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ])('should map %p to its status and code', (error, status, code) => {
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });
});
