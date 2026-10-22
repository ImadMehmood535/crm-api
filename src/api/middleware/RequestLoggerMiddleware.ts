import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/** One line per request: method, URL, status, duration. Never logs bodies (passwords, tokens). */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const started = Date.now();
    response.on('finish', () => {
      this.logger.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - started}ms`,
      );
    });
    next();
  }
}
