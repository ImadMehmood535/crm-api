import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

/** The request body as raw bytes (routes mounted with the raw parser in app.setup.ts). */
export const RawBody = createParamDecorator((_: unknown, context: ExecutionContext): Buffer => {
  const body = context.switchToHttp().getRequest<Request>().body as unknown;
  return Buffer.isBuffer(body) ? body : Buffer.alloc(0);
});
