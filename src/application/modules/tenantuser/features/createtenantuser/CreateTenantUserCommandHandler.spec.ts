import { META, passwordHasher, userRepository } from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  roleRepository,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import {
  customRole,
  owner,
  systemRole,
  tenantUserQueries,
  withPermissions,
} from '../../../../../../test/support/tenant-mocks';
import { User } from '@domain/aggregates/UserAggregate/User';

import { CreateTenantUserCommand } from './CreateTenantUserCommand';
import { CreateTenantUserCommandHandler } from './CreateTenantUserCommandHandler';

const input = {
  email: 'Hira@Skyline.example.com',
  firstName: 'Hira',
  lastName: 'Shah',
  roleIds: ['role-1', 'role-1'],
};

describe('CreateTenantUserCommandHandler', () => {
  const setup = () => {
    const users = userRepository();
    users.save.mockImplementation((u: User) =>
      Promise.resolve(
        User.rehydrate(
          'user-2',
          u.organizationId,
          u.email,
          u.firstName,
          u.lastName,
          u.status,
          u.createdBy,
        ),
      ),
    );
    const roles = roleRepository();
    roles.findActiveTenantRoles.mockResolvedValue([customRole()]);
    const handler = new CreateTenantUserCommandHandler(
      users,
      roles,
      tenantUserQueries(),
      passwordHasher(),
      auditLog(),
      unitOfWork,
    );
    return { handler, users, roles };
  };

  it('should create a must-reset user with the deduplicated roles', async () => {
    const { handler, users } = setup();

    const result = await handler.execute(new CreateTenantUserCommand(owner, input, META));

    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'hashed',
      true,
      {},
    );
    expect(users.replaceRoles).toHaveBeenCalledWith('user-2', ['role-1'], owner.userId, {});
    expect(result.temporaryPassword).toMatch(/^Tmp-/);
  });

  it('should answer 422 on roleIds when a role is not an active role of the company', async () => {
    const { handler, roles } = setup();
    roles.findActiveTenantRoles.mockResolvedValue([]);

    await expect(
      handler.execute(new CreateTenantUserCommand(owner, input, META)),
    ).rejects.toMatchObject({
      status: 422,
      details: [{ field: 'roleIds', messages: ['One or more roles do not exist.'] }],
    });
  });

  it('should refuse the built-in role, escalation and a registered email', async () => {
    const { handler, roles, users } = setup();
    roles.findActiveTenantRoles.mockResolvedValueOnce([systemRole()]);
    await expect(
      handler.execute(
        new CreateTenantUserCommand(owner, { ...input, roleIds: ['role-owner'] }, META),
      ),
    ).rejects.toMatchObject({
      code: 'SYSTEM_ROLE_PROTECTED',
    });

    roles.findActiveTenantRoles.mockResolvedValueOnce([customRole(['roles.edit'])]);
    await expect(
      handler.execute(
        new CreateTenantUserCommand(withPermissions('users.create', 'users.view'), input, META),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION' });

    users.emailExists.mockResolvedValue(true);
    await expect(
      handler.execute(new CreateTenantUserCommand(owner, input, META)),
    ).rejects.toMatchObject({
      code: 'EMAIL_CONFLICT',
    });
  });
});
