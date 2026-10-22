import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { Actor } from '@shared/auth/Actor';
import { UnauthenticatedError } from '@shared/errors/AppError';

import { AuthenticatedRequest } from './AuthenticatedRequest';

/** The caller the AuthGuard resolved for this request. */
export const CurrentActor = createParamDecorator((_: unknown, context: ExecutionContext): Actor => {
  const actor = context.switchToHttp().getRequest<AuthenticatedRequest>().actor;
  if (!actor) throw new UnauthenticatedError();
  return actor;
});
