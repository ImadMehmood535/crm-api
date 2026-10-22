import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AllExceptionsFilter } from '@api/filters/AllExceptionsFilter';
import { EnvelopeInterceptor } from '@api/interceptors/EnvelopeInterceptor';
import { createValidationPipe } from '@api/pipes/createValidationPipe';

export const API_PREFIX = 'api/v1';

/** Everything main.ts and the e2e tests share, so tests run the real HTTP conventions. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
}
