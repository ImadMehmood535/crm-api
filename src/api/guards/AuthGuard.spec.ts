import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QueryBus } from '@nestjs/cqrs';

import { actor } from '../../../test/support/auth-mocks';
import { ForbiddenError, UnauthenticatedError } from '@shared/errors/AppError';

import { ALLOW_WHEN_RESET_REQUIRED } from '../common/AllowWhenResetRequired';
import { AuthenticatedRequest } from '../common/AuthenticatedRequest';
import { IS_PUBLIC } from '../common/Public';
import { AuthGuard } from './AuthGuard';

describe('AuthGuard', () => {
  const contextFor = (request: Partial<AuthenticatedRequest>): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const setup = (metadata: Record<string, boolean> = {}, resolved = actor()) => {
    const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector;
    const queryBus = { execute: jest.fn().mockResolvedValue(resolved) } as unknown as QueryBus;
    return { guard: new AuthGuard(reflector, queryBus), queryBus };
  };

  it('should let a public route through without a token', async () => {
    const { guard, queryBus } = setup({ [IS_PUBLIC]: true });

    expect(await guard.canActivate(contextFor({ headers: {} }))).toBe(true);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('should refuse a request without a bearer token', async () => {
    const { guard } = setup();

    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Basic abc' } })),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('should resolve the actor and attach it to the request', async () => {
    const { guard } = setup();
    const request: Partial<AuthenticatedRequest> = { headers: { authorization: 'Bearer a.b.c' } };

    expect(await guard.canActivate(contextFor(request))).toBe(true);
    expect(request.actor).toEqual(actor());
  });

  it('should block a user who must reset their password with PASSWORD_RESET_REQUIRED', async () => {
    const { guard } = setup({}, actor({ mustResetPassword: true }));

    const act = guard.canActivate(contextFor({ headers: { authorization: 'Bearer a.b.c' } }));

    await expect(act).rejects.toBeInstanceOf(ForbiddenError);
    await expect(act).rejects.toMatchObject({ code: 'PASSWORD_RESET_REQUIRED' });
  });

  it('should let that user reach routes marked AllowWhenResetRequired', async () => {
    const { guard } = setup(
      { [ALLOW_WHEN_RESET_REQUIRED]: true },
      actor({ mustResetPassword: true }),
    );

    expect(
      await guard.canActivate(contextFor({ headers: { authorization: 'Bearer a.b.c' } })),
    ).toBe(true);
  });
});
