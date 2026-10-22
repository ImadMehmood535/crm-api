import {
  adminQueries,
  platformAdmin,
  tenantUser,
} from '../../../../../../test/support/platform-mocks';

import { GetPlatformAdminsQuery } from './GetPlatformAdminsQuery';
import { GetPlatformAdminsQueryHandler } from './GetPlatformAdminsQueryHandler';

describe('GetPlatformAdminsQueryHandler', () => {
  it('should list admins for any platform user and refuse tenants', async () => {
    const handler = new GetPlatformAdminsQueryHandler(adminQueries());

    expect(
      (await handler.execute(new GetPlatformAdminsQuery(platformAdmin, { page: 1, pageSize: 20 })))
        .meta.total,
    ).toBe(1);
    await expect(
      handler.execute(new GetPlatformAdminsQuery(tenantUser, { page: 1, pageSize: 20 })),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });
});
