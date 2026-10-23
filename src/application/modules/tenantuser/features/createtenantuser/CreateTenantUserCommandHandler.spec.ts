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
import {
  atLevel,
  department,
  departmentRepository,
  teamRepository,
} from '../../../../../../test/support/org-mocks';
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
          u.level,
        ),
      ),
    );
    const roles = roleRepository();
    roles.findActiveTenantRoles.mockResolvedValue([customRole()]);
    const teams = teamRepository();
    const departments = departmentRepository();
    const handler = new CreateTenantUserCommandHandler(
      users,
      roles,
      teams,
      departments,
      tenantUserQueries(),
      passwordHasher(),
      auditLog(),
      unitOfWork,
    );
    return { handler, users, roles, teams, departments };
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
        new CreateTenantUserCommand(
          { ...withPermissions('users.create', 'users.view'), level: 'admin' },
          input,
          META,
        ),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION' });

    users.emailExists.mockResolvedValue(true);
    await expect(
      handler.execute(new CreateTenantUserCommand(owner, input, META)),
    ).rejects.toMatchObject({
      code: 'EMAIL_CONFLICT',
    });
  });

  it('should default the level to member and refuse levels the caller may not create', async () => {
    const { handler, users } = setup();
    await handler.execute(new CreateTenantUserCommand(owner, input, META));
    expect(users.save.mock.calls[0][0].level).toBe('member');

    await expect(
      handler.execute(
        new CreateTenantUserCommand(atLevel('admin'), { ...input, level: 'admin' }, META),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_OPERATION' });
    await expect(
      handler.execute(new CreateTenantUserCommand(atLevel('member'), input, META)),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_OPERATION' });
  });

  it('should let an admin create a department head', async () => {
    const { handler, users } = setup();

    await handler.execute(
      new CreateTenantUserCommand(atLevel('admin'), { ...input, level: 'department_head' }, META),
    );

    expect(users.save.mock.calls[0][0].level).toBe('department_head');
  });

  it("should add a head's new member to a team of their department", async () => {
    const { handler, teams } = setup();

    await handler.execute(
      new CreateTenantUserCommand(
        atLevel('department_head'),
        { ...input, teamIds: ['team-1', 'team-1'] },
        META,
      ),
    );

    expect(teams.addMember).toHaveBeenCalledTimes(1);
    expect(teams.addMember).toHaveBeenCalledWith('team-1', 'user-2', 'department_head-1', {});
  });

  it('should answer 422 on teamIds for a team the caller may not manage or that does not exist', async () => {
    const { handler, teams, departments } = setup();
    departments.findById.mockResolvedValue(department('someone-else'));
    await expect(
      handler.execute(
        new CreateTenantUserCommand(
          atLevel('department_head'),
          { ...input, teamIds: ['team-1'] },
          META,
        ),
      ),
    ).rejects.toMatchObject({ status: 422, details: [{ field: 'teamIds' }] });

    teams.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new CreateTenantUserCommand(owner, { ...input, teamIds: ['team-x'] }, META)),
    ).rejects.toMatchObject({ status: 422, details: [{ field: 'teamIds' }] });
  });

  it('should give admins and heads their built-in role, ignoring roleIds', async () => {
    const { handler, users, roles } = setup();

    await handler.execute(new CreateTenantUserCommand(owner, { ...input, level: 'admin' }, META));
    await handler.execute(
      new CreateTenantUserCommand(
        owner,
        { ...input, roleIds: undefined, level: 'department_head' },
        META,
      ),
    );

    expect(roles.findActiveTenantRoles).not.toHaveBeenCalled();
    expect(users.replaceRoles).toHaveBeenNthCalledWith(
      1,
      'user-2',
      ['role-level-admin'],
      owner.userId,
      {},
    );
    expect(users.replaceRoles).toHaveBeenNthCalledWith(
      2,
      'user-2',
      ['role-level-department_head'],
      owner.userId,
      {},
    );
  });

  it('should require roles for a member', async () => {
    const { handler, roles } = setup();
    roles.findActiveTenantRoles.mockResolvedValue([]);

    await expect(
      handler.execute(new CreateTenantUserCommand(owner, { ...input, roleIds: undefined }, META)),
    ).rejects.toMatchObject({
      status: 422,
      details: [{ field: 'roleIds', messages: ['Choose at least one role.'] }],
    });
  });
});
