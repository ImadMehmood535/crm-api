import { ValidationError, ValidationPipe } from '@nestjs/common';

import { ErrorDetail, ValidationFailedError } from '@shared/errors/AppError';

/** class-validator errors → one detail per field, nested fields in dot notation. */
export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parent = '',
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, messages: Object.values(error.constraints) }] : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/** Rejects unknown properties and reports every bad field at once as 422 VALIDATION_FAILED. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new ValidationFailedError(flattenValidationErrors(errors)),
  });
}
