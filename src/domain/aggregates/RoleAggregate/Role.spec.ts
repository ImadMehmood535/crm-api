import { ForbiddenError, ValidationFailedError } from '@shared/errors/AppError';

import { Role, roleCodeFrom } from './Role';

const props = {
  organizationId: 'org-1',
  name: ' HR Assistant ',
  description: '  ',
  permissions: ['users.view', 'users.create', 'users.view'],
};

describe('Role', () => {
  describe('create', () => {
    it('should trim the name, derive the code, clear a blank description and dedupe sorted grants', () => {
      const role = Role.create(props);

      expect(role.id).toBeNull();
      expect(role.name).toBe('HR Assistant');
      expect(role.code).toBe('hr_assistant');
      expect(role.description).toBeNull();
      expect(role.permissions).toEqual(['users.create', 'users.view']);
      expect(role.isSystem).toBe(false);
      expect(role.isActive).toBe(true);
    });
  });

  describe('rename', () => {
    it.each(['A', '!!', 'a'.repeat(61)])('should reject %p on name', (name) => {
      const role = Role.create(props);

      const act = (): void => role.rename(name);

      expect(act).toThrow(ValidationFailedError);
      expect(act).toThrow(
        expect.objectContaining({ details: [expect.objectContaining({ field: 'name' })] }) as Error,
      );
    });

    it('should accept 2 and 60 characters and re-derive the code', () => {
      const role = Role.create(props);

      role.rename('QA');
      expect(role.code).toBe('qa');
      role.rename('a'.repeat(60));
      expect(role.name).toHaveLength(60);
    });
  });

  describe('describe', () => {
    it('should accept 200 characters and reject 201', () => {
      const role = Role.create(props);

      role.describe('d'.repeat(200));
      expect(role.description).toHaveLength(200);
      expect(() => role.describe('d'.repeat(201))).toThrow(
        'Description must be 200 characters or fewer.',
      );
    });
  });

  describe('assertEditable / deactivate', () => {
    it('should protect the system role', () => {
      const system = Role.rehydrate(
        'r1',
        'org-1',
        'Owner',
        'developer_super_user',
        null,
        [],
        true,
        true,
      );

      expect(() => system.assertEditable()).toThrow(ForbiddenError);
      expect(() => system.assertEditable()).toThrow(
        expect.objectContaining({ code: 'SYSTEM_ROLE_PROTECTED' }) as Error,
      );
    });

    it('should deactivate a custom role', () => {
      const role = Role.create(props);

      role.assertEditable();
      role.deactivate();

      expect(role.isActive).toBe(false);
    });
  });

  describe('roleCodeFrom', () => {
    it('should collapse symbols and trim underscores', () => {
      expect(roleCodeFrom('  Sales -- Team!  ')).toBe('sales_team');
    });
  });
});
