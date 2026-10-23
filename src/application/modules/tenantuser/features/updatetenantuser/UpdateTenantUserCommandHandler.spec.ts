import {
  META,
  passwordHasher,
  sessionRepository,
  userRepository,
} from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  roleRepository,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import {
  customRole,
  owner,
  tenantUserQueries,
  tenantUserReadModel,
  withPermissions,
} from '../../../../../../test/support/tenant-mocks';
import { atLevel } from '../../../../../../test/support/org-mocks';
import { User } from '@domain/aggregates/UserAggregate/User';
import { NotFoundError } from '@shared/errors/AppError';

import { ChangeTenantUserStatusCommand } from '../changetenantuserstatus/ChangeTenantUserStatusCommand';
import { ChangeTenantUserStatusCommandHandler } from '../changetenantuserstatus/ChangeTenantUserStatusCommandHandler';
import { ResetTenantUserPasswordCommand } from '../resettenantuserpassword/ResetTenantUserPasswordCommand';
import { ResetTenantUserPasswordCommandHandler } from '../resettenantuserpassword/ResetTenantUserPasswordCommandHandler';
import { UpdateTenantUserCommand } from './UpdateTenantUserCommand';
import { UpdateTenantUserCommandHandler } from './UpdateTenantUserCommandHandler';

describe('Tenant user management handlers', () => {
  const setup = (target = tenantUserReadModel()) => {
    const users = userRepository();
    users.findTenantUser.mockResolvedValue(
      User.rehydrate(target.id, 'org-1', target.email, 'Hira', 'Shah', 'active', null),
    );
    const roles = roleRepository();
    roles.findActiveTenantRoles.mockResolvedValue([customRole(['projects.view'], 'role-2')]);
    const sessions = sessionRepository();
    const queries = tenantUserQueries(target);
    return {
      users,
      sessions,
      update: new UpdateTenantUserCommandHandler(users, roles, queries, auditLog(), unitOfWork),
      status: new ChangeTenantUserStatusCommandHandler(
        users,
        sessions,
        queries,
        auditLog(),
        unitOfWork,
      ),
      reset: new ResetTenantUserPasswordCommandHandler(
        users,
        sessions,
        queries,
        passwordHasher(),
        auditLog(),
        unitOfWork,
      ),
    };
  };

  it('should update names and replace roles', async () => {
    const { users, update } = setup();

    await update.execute(
      new UpdateTenantUserCommand(
        owner,
        'user-2',
        { firstName: 'Hira B', roleIds: ['role-2'] },
        META,
      ),
    );

    expect(users.update).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Hira B', lastName: 'Shah' }),
      {},
    );
    expect(users.replaceRoles).toHaveBeenCalledWith('user-2', ['role-2'], owner.userId, {});
  });

  it('should answer NOT_FOUND, protect the owner and stronger users, and refuse own role changes', async () => {
    await expect(
      new UpdateTenantUserCommandHandler(
        userRepository(),
        roleRepository(),
        tenantUserQueries(null),
        auditLog(),
        unitOfWork,
      ).execute(new UpdateTenantUserCommand(owner, 'x', {}, META)),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      setup(tenantUserReadModel({ isOwner: true })).update.execute(
        new UpdateTenantUserCommand(owner, 'user-2', {}, META),
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN_OPERATION',
      message: 'The company owner cannot be changed here.',
    });
    await expect(
      setup(tenantUserReadModel({ permissions: ['roles.edit'] })).update.execute(
        new UpdateTenantUserCommand(
          withPermissions('users.edit', 'users.view'),
          'user-2',
          {},
          META,
        ),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION' });
    await expect(
      setup(tenantUserReadModel({ id: 'staff-1', permissions: [] })).update.execute(
        new UpdateTenantUserCommand(
          withPermissions('users.edit'),
          'staff-1',
          { roleIds: ['role-2'] },
          META,
        ),
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN_OPERATION',
      message: 'You cannot change your own roles.',
    });
  });

  it('should change a level only when the caller may create both the current and the new level', async () => {
    const { users, update } = setup();
    await update.execute(new UpdateTenantUserCommand(owner, 'user-2', { level: 'admin' }, META));
    expect(users.update).toHaveBeenCalledWith(expect.objectContaining({ level: 'admin' }), {});

    await expect(
      setup().update.execute(
        new UpdateTenantUserCommand(atLevel('admin'), 'user-2', { level: 'admin' }, META),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_OPERATION' });
    await expect(
      setup(tenantUserReadModel({ level: 'admin' })).update.execute(
        new UpdateTenantUserCommand(atLevel('admin'), 'user-2', { level: 'member' }, META),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_OPERATION' });
  });

  it('should swap the built-in role on promotion and require roles on a move down to member', async () => {
    const { users, update } = setup();
    await update.execute(
      new UpdateTenantUserCommand(owner, 'user-2', { level: 'department_head' }, META),
    );
    expect(users.replaceRoles).toHaveBeenCalledWith(
      'user-2',
      ['role-level-department_head'],
      owner.userId,
      {},
    );

    const head = tenantUserReadModel({ level: 'department_head' });
    await expect(
      setup(head).update.execute(
        new UpdateTenantUserCommand(owner, 'user-2', { level: 'member' }, META),
      ),
    ).rejects.toMatchObject({ status: 422, details: [{ field: 'roleIds' }] });
    const demote = setup(head);
    await demote.update.execute(
      new UpdateTenantUserCommand(owner, 'user-2', { level: 'member', roleIds: ['role-2'] }, META),
    );
    expect(demote.users.replaceRoles).toHaveBeenCalledWith('user-2', ['role-2'], owner.userId, {});
  });

  it('should refuse hand-picked roles for an admin or a head', async () => {
    await expect(
      setup(tenantUserReadModel({ level: 'admin' })).update.execute(
        new UpdateTenantUserCommand(owner, 'user-2', { roleIds: ['role-2'] }, META),
      ),
    ).rejects.toMatchObject({ status: 422, details: [{ field: 'roleIds' }] });
  });

  it('should deactivate with session revocation, reactivate without, and refuse self-deactivation', async () => {
    const { users, sessions, status } = setup();

    await status.execute(new ChangeTenantUserStatusCommand(owner, 'user-2', 'deactivate', META));
    expect(users.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'inactive' }),
      {},
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-2', 'account_deactivated', {});

    await status.execute(new ChangeTenantUserStatusCommand(owner, 'user-2', 'activate', META));
    expect(users.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'active' }),
      {},
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledTimes(1);

    await expect(
      setup(tenantUserReadModel({ id: owner.userId })).status.execute(
        new ChangeTenantUserStatusCommand(owner, owner.userId, 'deactivate', META),
      ),
    ).rejects.toMatchObject({ message: 'You cannot deactivate your own account.' });
  });

  it("should reset another user's password (must reset, sessions revoked) but not your own", async () => {
    const { users, sessions, reset } = setup();

    const result = await reset.execute(new ResetTenantUserPasswordCommand(owner, 'user-2', META));

    expect(users.setPassword).toHaveBeenCalledWith('user-2', 'hashed', true, {});
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-2', 'password_reset', {});
    expect(result.temporaryPassword).toMatch(/^Tmp-/);
    await expect(
      setup(tenantUserReadModel({ id: owner.userId })).reset.execute(
        new ResetTenantUserPasswordCommand(owner, owner.userId, META),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_OPERATION' });
  });
});
