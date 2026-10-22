import {
  owner,
  tenantUserQueries,
  withPermissions,
} from '../../../../../../test/support/tenant-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { GetTenantUserQuery } from '../gettenantuser/GetTenantUserQuery';
import { GetTenantUserQueryHandler } from '../gettenantuser/GetTenantUserQueryHandler';
import { GetTenantUsersQuery } from './GetTenantUsersQuery';
import { GetTenantUsersQueryHandler } from './GetTenantUsersQueryHandler';

describe('Tenant user query handlers', () => {
  it('should scope the list to the caller company and require users.view', async () => {
    const queries = tenantUserQueries();

    await new GetTenantUsersQueryHandler(queries).execute(
      new GetTenantUsersQuery(owner, { page: 1, pageSize: 20, status: 'active' }),
    );

    expect(queries.findList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: 'active',
      organizationId: 'org-1',
    });
    await expect(
      new GetTenantUsersQueryHandler(queries).execute(
        new GetTenantUsersQuery(withPermissions('roles.view'), { page: 1, pageSize: 20 }),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('should return one user or NOT_FOUND', async () => {
    expect(
      (
        await new GetTenantUserQueryHandler(tenantUserQueries()).execute(
          new GetTenantUserQuery(owner, 'user-2'),
        )
      ).email,
    ).toBe('hira@skyline.example.com');
    await expect(
      new GetTenantUserQueryHandler(tenantUserQueries(null)).execute(
        new GetTenantUserQuery(owner, 'x'),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
