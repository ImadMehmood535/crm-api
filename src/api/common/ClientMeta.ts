import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

import { RequestMeta } from '@shared/auth/Actor';

/** Caller IP (first X-Forwarded-For hop, else the socket) and user agent, for session records. */
export const ClientMeta = createParamDecorator(
  (_: unknown, context: ExecutionContext): RequestMeta => {
    const request = context.switchToHttp().getRequest<Request>();
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    return {
      ipAddress: first || request.socket.remoteAddress || null,
      userAgent: request.headers['user-agent'] ?? null,
    };
  },
);
