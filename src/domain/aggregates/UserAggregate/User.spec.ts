import { ValidationFailedError } from '@shared/errors/AppError';

import { User, normalizeEmail } from './User';

const props = {
  email: ' Owner@Palm.Example.com ',
  firstName: ' Sara ',
  lastName: 'Khan',
  createdBy: 'op-1',
};

describe('User', () => {
  describe('createTenantUser', () => {
    it('should create an active tenant user with a normalised email and trimmed names', () => {
      const user = User.createTenantUser('org-1', props);

      expect(user.id).toBeNull();
      expect(user.organizationId).toBe('org-1');
      expect(user.email).toBe('owner@palm.example.com');
      expect(user.firstName).toBe('Sara');
      expect(user.status).toBe('active');
      expect(user.createdBy).toBe('op-1');
    });
  });

  describe('createPlatformAdmin', () => {
    it('should create a platform user without a company', () => {
      expect(User.createPlatformAdmin(props).organizationId).toBeNull();
    });
  });

  describe('rename', () => {
    it('should require both names and cap them at 100 characters', () => {
      const user = User.createPlatformAdmin(props);

      expect(() => user.rename(' ', 'Khan')).toThrow('First name is required.');
      expect(() => user.rename('Sara', 'a'.repeat(101))).toThrow(
        'Last name must be 100 characters or fewer.',
      );
      user.rename('a'.repeat(100), 'K');
      expect(user.firstName).toHaveLength(100);
    });
  });

  describe('deactivate / activate', () => {
    it('should switch the status', () => {
      const user = User.rehydrate('u1', null, 'a@b.co', 'A', 'B', 'active', null);

      user.deactivate();
      expect(user.status).toBe('inactive');
      user.activate();
      expect(user.status).toBe('active');
    });
  });

  describe('normalizeEmail', () => {
    it('should reject an invalid address on the given field', () => {
      const act = (): string => normalizeEmail('not-an-email', 'superUser.email');

      expect(act).toThrow(ValidationFailedError);
      expect(act).toThrow(
        expect.objectContaining({
          details: [{ field: 'superUser.email', messages: ['Enter a valid email address.'] }],
        }) as Error,
      );
    });
  });
});
