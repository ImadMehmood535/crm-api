import { actor } from '../../../test/support/auth-mocks';
import { ForbiddenError } from '@shared/errors/AppError';

import {
  assertHoldsAll,
  requirePermission,
  requirePlatform,
  requirePlatformSuperUser,
  requireTenant,
} from './Authorization';

describe('Authorization', () => {
  const platformSuper = actor({
    plane: 'platform',
    organizationId: null,
    roles: ['platform_super_user'],
  });
  const platformAdmin = actor({
    plane: 'platform',
    organizationId: null,
    roles: ['platform_admin'],
  });

  it('should let platform users through requirePlatform and stop tenant users', () => {
    expect(() => requirePlatform(platformAdmin)).not.toThrow();
    expect(() => requirePlatform(actor())).toThrow(ForbiddenError);
    expect(() => requirePlatform(actor())).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });

  it('should only let the platform super user through requirePlatformSuperUser', () => {
    expect(() => requirePlatformSuperUser(platformSuper)).not.toThrow();
    expect(() => requirePlatformSuperUser(platformAdmin)).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
    expect(() => requirePlatformSuperUser(actor())).toThrow(ForbiddenError);
  });

  it('should return the company id for tenant users and refuse platform users', () => {
    expect(requireTenant(actor())).toBe('org-1');
    expect(() => requireTenant(platformAdmin)).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });

  it('should require the permission code', () => {
    const viewer = actor({ permissions: ['users.view'] });

    expect(requirePermission(viewer, 'users.view')).toBe('org-1');
    expect(() => requirePermission(viewer, 'users.edit')).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });

  it('should answer PERMISSION_ESCALATION when a code is not held', () => {
    const viewer = actor({ permissions: ['users.view'] });

    expect(() => assertHoldsAll(viewer, ['users.view'])).not.toThrow();
    expect(() => assertHoldsAll(viewer, ['users.view', 'roles.edit'], 'No.')).toThrow(
      expect.objectContaining({
        status: 403,
        code: 'PERMISSION_ESCALATION',
        message: 'No.',
      }) as Error,
    );
  });
});
