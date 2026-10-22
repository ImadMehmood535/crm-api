import { ForbiddenError } from '@shared/errors/AppError';

import { assertCanAuthenticate } from './AccessPolicy';

describe('assertCanAuthenticate', () => {
  it('should allow an active user of an active company or of the platform', () => {
    expect(() => assertCanAuthenticate('active', 'active')).not.toThrow();
    expect(() => assertCanAuthenticate('active', null)).not.toThrow();
  });

  it('should refuse a suspended company before looking at the user', () => {
    const act = (): void => assertCanAuthenticate('inactive', 'suspended');

    expect(act).toThrow(ForbiddenError);
    expect(act).toThrow(expect.objectContaining({ code: 'ORGANIZATION_SUSPENDED' }) as Error);
  });

  it('should refuse an inactive user with ACCOUNT_INACTIVE', () => {
    expect(() => assertCanAuthenticate('inactive', 'active')).toThrow(
      expect.objectContaining({ code: 'ACCOUNT_INACTIVE' }) as Error,
    );
  });
});
