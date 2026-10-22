import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';

import { ConflictError, ValidationFailedError } from '@shared/errors/AppError';

import { AllExceptionsFilter } from './AllExceptionsFilter';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('should map an AppError to its status, code, message and details', () => {
    const error = ValidationFailedError.forField('email', 'Email is invalid.');

    expect(filter.toError(error)).toEqual({
      status: 422,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Email is invalid.',
        details: [{ field: 'email', messages: ['Email is invalid.'] }],
      },
    });
  });

  it('should leave out details when an AppError has none', () => {
    expect(filter.toError(new ConflictError('SLUG_CONFLICT', 'Taken.')).error).toEqual({
      code: 'SLUG_CONFLICT',
      message: 'Taken.',
    });
  });

  it('should map an unknown route to 404 NOT_FOUND', () => {
    expect(filter.toError(new NotFoundException('Cannot GET /x'))).toEqual({
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('should map other Nest exceptions by status', () => {
    expect(filter.toError(new ForbiddenException('No')).error.code).toBe('PERMISSION_DENIED');
  });

  it('should map a body-parser failure to 400 BAD_REQUEST', () => {
    const parseError = Object.assign(new SyntaxError('Unexpected end'), { status: 400 });

    expect(filter.toError(parseError)).toEqual({
      status: 400,
      error: { code: 'BAD_REQUEST', message: 'Malformed request body' },
    });
  });

  it('should hide anything unexpected behind 500 INTERNAL_ERROR', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    expect(filter.toError(new Error('db password is hunter2'))).toEqual({
      status: 500,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
