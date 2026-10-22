import { META } from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  roleRepository,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import { owner, rbacQueries, withPermissions } from '../../../../../../test/support/tenant-mocks';
import { Role } from '@domain/aggregates/RoleAggregate/Role';

import { CreateRoleCommand } from './CreateRoleCommand';
import { CreateRoleCommandHandler } from './CreateRoleCommandHandler';

describe('CreateRoleCommandHandler', () => {
  const setup = () => {
    const roles = roleRepository();
    roles.saveTenantRole.mockImplementation((r: Role) =>
      Promise.resolve(
        Role.rehydrate(
          'role-9',
          r.organizationId,
          r.name,
          r.code,
          r.description,
          [...r.permissions],
          false,
          true,
        ),
      ),
    );
    const audit = auditLog();
    return {
      handler: new CreateRoleCommandHandler(roles, rbacQueries(), audit, unitOfWork),
      roles,
      audit,
    };
  };
  const command = (actor = owner, permissions = ['users.view']) =>
    new CreateRoleCommand(actor, { name: 'HR Assistant', permissions }, META);

  it('should save the role with its grants for the caller company and audit it', async () => {
    const { handler, roles, audit } = setup();

    await handler.execute(command());

    expect(roles.saveTenantRole).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        code: 'hr_assistant',
        permissions: ['users.view'],
      }),
      owner.userId,
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role.created', organizationId: 'org-1' }),
      {},
    );
  });

  it('should require roles.create', async () => {
    await expect(
      setup().handler.execute(command(withPermissions('roles.view'))),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('should reject unknown codes on permissions, escalation and duplicate names', async () => {
    const { handler, roles } = setup();

    await expect(handler.execute(command(owner, ['nope.view']))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'permissions', messages: ['Unknown permission(s): nope.view.'] }],
    });
    await expect(
      handler.execute(command(withPermissions('roles.create', 'users.view'), ['users.edit'])),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION' });
    roles.activeCodeExists.mockResolvedValue(true);
    await expect(handler.execute(command())).rejects.toMatchObject({
      status: 409,
      code: 'ROLE_NAME_CONFLICT',
    });
  });
});
