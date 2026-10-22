import { owner, rbacQueries, withPermissions } from '../../../../../../test/support/tenant-mocks';

import { GetPermissionsQuery } from '../getpermissions/GetPermissionsQuery';
import { GetPermissionsQueryHandler } from '../getpermissions/GetPermissionsQueryHandler';
import { GetRolesQuery } from './GetRolesQuery';
import { GetRolesQueryHandler } from './GetRolesQueryHandler';

describe('Role query handlers', () => {
  it('should scope the role list to the caller company', async () => {
    const rbac = rbacQueries();

    const result = await new GetRolesQueryHandler(rbac).execute(
      new GetRolesQuery(owner, { page: 1, pageSize: 20 }),
    );

    expect(rbac.findRoles).toHaveBeenCalledWith({ page: 1, pageSize: 20, organizationId: 'org-1' });
    expect(result.meta.total).toBe(1);
  });

  it('should require roles.view for roles and the catalogue', async () => {
    const noView = withPermissions('users.view');

    await expect(
      new GetRolesQueryHandler(rbacQueries()).execute(
        new GetRolesQuery(noView, { page: 1, pageSize: 20 }),
      ),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    await expect(
      new GetPermissionsQueryHandler(rbacQueries()).execute(new GetPermissionsQuery(noView)),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    expect(
      await new GetPermissionsQueryHandler(rbacQueries()).execute(new GetPermissionsQuery(owner)),
    ).toEqual([]);
  });
});
