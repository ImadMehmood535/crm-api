import { META } from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  roleRepository,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import {
  customRole,
  owner,
  rbacQueries,
  systemRole,
  withPermissions,
} from '../../../../../../test/support/tenant-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { DeleteRoleCommand } from '../deleterole/DeleteRoleCommand';
import { DeleteRoleCommandHandler } from '../deleterole/DeleteRoleCommandHandler';
import { UpdateRoleCommand } from './UpdateRoleCommand';
import { UpdateRoleCommandHandler } from './UpdateRoleCommandHandler';

describe('Update / delete role handlers', () => {
  const setup = () => {
    const roles = roleRepository();
    const audit = auditLog();
    return {
      roles,
      audit,
      update: new UpdateRoleCommandHandler(roles, rbacQueries(), audit, unitOfWork),
      remove: new DeleteRoleCommandHandler(roles, audit, unitOfWork),
    };
  };

  it('should rename, regrant and audit old and new values', async () => {
    const { roles, audit, update } = setup();
    roles.findTenantRole.mockResolvedValue(customRole(['users.view']));

    await update.execute(
      new UpdateRoleCommand(
        owner,
        'role-1',
        { name: 'Sales Team', permissions: ['projects.view'] },
        META,
      ),
    );

    expect(roles.updateTenantRole).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'sales_team', permissions: ['projects.view'] }),
      owner.userId,
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ oldValues: { name: 'Sales', permissions: ['users.view'] } }),
      {},
    );
  });

  it('should answer NOT_FOUND, SYSTEM_ROLE_PROTECTED and escalation in that order', async () => {
    const { roles, update } = setup();
    roles.findTenantRole.mockResolvedValueOnce(null);
    await expect(
      update.execute(new UpdateRoleCommand(owner, 'x', {}, META)),
    ).rejects.toBeInstanceOf(NotFoundError);

    roles.findTenantRole.mockResolvedValueOnce(systemRole());
    await expect(
      update.execute(new UpdateRoleCommand(owner, 'role-owner', {}, META)),
    ).rejects.toMatchObject({
      code: 'SYSTEM_ROLE_PROTECTED',
    });

    roles.findTenantRole.mockResolvedValueOnce(customRole(['branding.edit']));
    await expect(
      update.execute(
        new UpdateRoleCommand(
          withPermissions('roles.edit', 'users.view'),
          'role-1',
          { name: 'X Y' },
          META,
        ),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION' });
  });

  it('should deactivate an unused role and refuse a role in use', async () => {
    const { roles, audit, remove } = setup();
    roles.findTenantRole.mockResolvedValue(customRole());

    expect(await remove.execute(new DeleteRoleCommand(owner, 'role-1', META))).toBeNull();
    expect(roles.updateTenantRole).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
      owner.userId,
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role.deactivated' }),
      {},
    );

    roles.findTenantRole.mockResolvedValue(customRole());
    roles.countHolders.mockResolvedValue(1);
    await expect(
      remove.execute(new DeleteRoleCommand(owner, 'role-1', META)),
    ).rejects.toMatchObject({
      code: 'ROLE_IN_USE',
      message: 'This role is assigned to 1 user; reassign them first.',
    });
  });

  it('should not deactivate an already inactive role', async () => {
    const { roles, remove } = setup();
    const inactive = customRole();
    inactive.deactivate();
    roles.findTenantRole.mockResolvedValue(inactive);

    await expect(
      remove.execute(new DeleteRoleCommand(owner, 'role-1', META)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
