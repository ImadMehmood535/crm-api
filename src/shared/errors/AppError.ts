/** One field's validation messages, as the frontend maps them onto form fields. */
export interface ErrorDetail {
  readonly field?: string;
  readonly messages: readonly string[];
}

/**
 * Framework-free error with an HTTP status and a stable machine-readable code.
 * AllExceptionsFilter turns it into `{ success: false, error: { code, message, details } }`.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;

  constructor(
    readonly code: string,
    message: string,
    readonly details?: readonly ErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationFailedError extends AppError {
  readonly status = 422;

  constructor(details: readonly ErrorDetail[], message = 'Validation failed') {
    super('VALIDATION_FAILED', message, details);
  }

  static forField(field: string, message: string): ValidationFailedError {
    return new ValidationFailedError([{ field, messages: [message] }], message);
  }
}

export class BadRequestError extends AppError {
  readonly status = 400;

  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(code, message);
  }
}

export class UnauthenticatedError extends AppError {
  readonly status = 401;

  constructor(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    super(code, message);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;

  constructor(code: string, message: string) {
    super(code, message);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;

  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(code, message);
  }
}

export class ConflictError extends AppError {
  readonly status = 409;

  constructor(code: string, message: string, details?: readonly ErrorDetail[]) {
    super(code, message, details);
  }
}
