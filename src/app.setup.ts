import { INestApplication } from '@nestjs/common';
import { raw } from 'express';
import { Reflector } from '@nestjs/core';

import { AllExceptionsFilter } from '@api/filters/AllExceptionsFilter';
import { EnvelopeInterceptor } from '@api/interceptors/EnvelopeInterceptor';
import { createValidationPipe } from '@api/pipes/createValidationPipe';

export const API_PREFIX = 'api/v1';

/** Image uploads arrive as raw bytes of any declared type: the domain checks the real format. */
const RAW_UPLOAD_ROUTE = `/${API_PREFIX}/me/branding/assets`;
const RAW_UPLOAD_LIMIT = '2mb';

/** Everything main.ts and the e2e tests share, so tests run the real HTTP conventions. */
export function configureApp(app: INestApplication): void {
  app.use(RAW_UPLOAD_ROUTE, raw({ type: () => true, limit: RAW_UPLOAD_LIMIT }));
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
}
