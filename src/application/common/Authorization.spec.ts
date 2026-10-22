import { actor } from '../../../test/support/auth-mocks';
import { ForbiddenError } from '@shared/errors/AppError';

import { requirePlatform, requirePlatformSuperUser } from './Authorization';

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
});
