import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';

import { PagedResult } from '@shared/utils/Pagination';

import { RAW_RESPONSE } from '../common/RawResponse';

/** Wraps results as `{ success: true, data }`, or `{ success: true, data: items, meta }` for pages. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) return next.handle();
    return next.handle().pipe(map((result: unknown) => wrap(result)));
  }
}

export function wrap(result: unknown): object {
  if (result instanceof PagedResult)
    return { success: true, data: result.items, meta: result.meta };
  return { success: true, data: result ?? null };
}
