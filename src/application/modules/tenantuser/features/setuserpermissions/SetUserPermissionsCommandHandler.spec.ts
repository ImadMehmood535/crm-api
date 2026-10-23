import { META, userRepository } from '../../../../../../test/support/auth-mocks';
import { auditLog, unitOfWork } from '../../../../../../test/support/platform-mocks';
import {
  owner,
  rbacQueries,
  tenantUserQueries,
  tenantUserReadModel,
  withPermissions,
} from '../../../../../../test/support/tenant-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { GetUserPermissionsQuery } from '../getuserpermissions/GetUserPermissionsQuery';
import { GetUserPermissionsQueryHandler } from '../getuserpermissions/GetUserPermissionsQueryHandler';
import { SetUserPermissionsCommand } from './SetUserPermissionsCommand';
import { SetUserPermissionsCommandHandler } from './SetUserPermissionsCommandHandler';

describe('User permission handlers', () => {
  const setup = (target = tenantUserReadModel()) => {
    const users = userRepository();
    const queries = tenantUserQueries(target);
    queries.findPermissionBreakdown.mockResolvedValue({
      rolePermissions: ['projects.view', 'units.view'],
      granted: [],
      revoked: [],
      permissions: ['projects.view', 'units.view'],
    });
    const audit = auditLog();
    return {
      users,
      queries,
      audit,
      set: new SetUserPermissionsCommandHandler(users, queries, rbacQueries(), audit, unitOfWork),
      get: new GetUserPermissionsQueryHandler(queries),
    };
  };
  const setTo = (codes: string[], actor = owner, id = 'user-2') =>
    new SetUserPermissionsCommand(actor, id, codes, META);

  it('should store grants and revokes as the difference from the role codes, and audit it', async () => {
    const { set, users, audit } = setup();

    await set.execute(setTo(['projects.edit', 'projects.view', 'projects.view']));

    expect(users.replacePermissionOverrides).toHaveBeenCalledWith(
      'user-2',
      ['projects.edit'],
      ['units.view'],
      owner.userId,
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.permissions_updated' }),
      {},
    );
  });

  it('should clear overrides when the role codes are sent back', async () => {
    const { set, users } = setup();

    await set.execute(setTo(['units.view', 'projects.view']));

    expect(users.replacePermissionOverrides).toHaveBeenCalledWith(
      'user-2',
      [],
      [],
      owner.userId,
      {},
    );
  });

  it('should refuse the owner, a stronger target, yourself, unknown codes and escalation', async () => {
    await expect(
      setup(tenantUserReadModel({ isOwner: true })).set.execute(setTo([])),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_OPERATION' });
    await expect(
      setup(tenantUserReadModel({ permissions: ['roles.edit'] })).set.execute(
        setTo([], withPermissions('users.edit', 'users.view')),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION' });
    await expect(
      setup(tenantUserReadModel({ id: owner.userId, isOwner: false, permissions: [] })).set.execute(
        setTo([], owner, owner.userId),
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN_OPERATION',
      message: 'You cannot change your own permissions.',
    });
    await expect(setup().set.execute(setTo(['ships.sail']))).rejects.toMatchObject({
      status: 422,
      details: [{ field: 'permissions' }],
    });
    await expect(
      setup(tenantUserReadModel({ permissions: [] })).set.execute(
        setTo(['projects.delete'], withPermissions('users.edit', 'projects.view')),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION' });
  });

  it('should return the breakdown, and 404 for a user the caller cannot see', async () => {
    const { get } = setup();
    expect((await get.execute(new GetUserPermissionsQuery(owner, 'user-2'))).permissions).toEqual([
      'projects.view',
      'units.view',
    ]);
    await expect(
      setup(null as never).get.execute(new GetUserPermissionsQuery(owner, 'x')),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(setup(null as never).set.execute(setTo([]))).rejects.toBeInstanceOf(NotFoundError);
  });
});
