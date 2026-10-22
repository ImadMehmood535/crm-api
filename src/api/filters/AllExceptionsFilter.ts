import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

import { AppError, ErrorDetail } from '@shared/errors/AppError';

interface ErrorBody {
  code: string;
  message: string;
  details?: readonly ErrorDetail[];
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
};

/** Turns every thrown value into `{ success: false, error: { code, message, details? } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, error } = this.toError(exception);
    response.status(status).json({ success: false, error });
  }

  toError(exception: unknown): { status: number; error: ErrorBody } {
    if (exception instanceof AppError) {
      const details = exception.details?.length ? { details: exception.details } : {};
      return {
        status: exception.status,
        error: { code: exception.code, message: exception.message, ...details },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = status === 404 ? 'Resource not found' : exception.message;
      return { status, error: { code: CODE_BY_STATUS[status] ?? 'ERROR', message } };
    }
    // Errors raised by Express middleware (body parser): malformed JSON, body too large, …
    const status = (exception as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      const message = status === 400 ? 'Malformed request body' : 'Request rejected';
      return { status, error: { code: CODE_BY_STATUS[status] ?? 'BAD_REQUEST', message } };
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return { status: 500, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };
  }
}
