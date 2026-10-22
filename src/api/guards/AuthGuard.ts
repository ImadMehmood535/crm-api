import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QueryBus } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';
import { ForbiddenError, UnauthenticatedError } from '@shared/errors/AppError';
import { ResolveActorQuery } from '@application/modules/auth/features/resolveactor/ResolveActorQuery';

import { ALLOW_WHEN_RESET_REQUIRED } from '../common/AllowWhenResetRequired';
import { AuthenticatedRequest } from '../common/AuthenticatedRequest';
import { IS_PUBLIC } from '../common/Public';

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]+)$/;

/** Global gate: every route needs a valid access token unless it is @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly queryBus: QueryBus,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthenticatedError();

    const actor = await this.queryBus.execute<ResolveActorQuery, Actor>(
      new ResolveActorQuery(token),
    );
    request.actor = actor;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_RESET_REQUIRED, targets);
    if (actor.mustResetPassword && !allowed) {
      throw new ForbiddenError(
        'PASSWORD_RESET_REQUIRED',
        'You must set a new password before continuing.',
      );
    }
    return true;
  }
}
