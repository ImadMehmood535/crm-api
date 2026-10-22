import {
  developer,
  developerQueries,
  platformAdmin,
  tenantUser,
} from '../../../../../../test/support/platform-mocks';
import { NotFoundError } from '@shared/errors/AppError';

import { GetDeveloperQuery } from '../getdeveloper/GetDeveloperQuery';
import { GetDeveloperQueryHandler } from '../getdeveloper/GetDeveloperQueryHandler';
import { GetDevelopersQuery } from './GetDevelopersQuery';
import { GetDevelopersQueryHandler } from './GetDevelopersQueryHandler';

describe('Developer query handlers', () => {
  it('should page developers for any platform user', async () => {
    const queries = developerQueries();

    const result = await new GetDevelopersQueryHandler(queries).execute(
      new GetDevelopersQuery(platformAdmin, { page: 2, pageSize: 10, search: 'palm' }),
    );

    expect(queries.findList).toHaveBeenCalledWith({ page: 2, pageSize: 10, search: 'palm' });
    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 1 });
  });

  it('should refuse tenant users', async () => {
    await expect(
      new GetDevelopersQueryHandler(developerQueries()).execute(
        new GetDevelopersQuery(tenantUser, { page: 1, pageSize: 20 }),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('should return one developer or NOT_FOUND', async () => {
    expect(
      await new GetDeveloperQueryHandler(developerQueries()).execute(
        new GetDeveloperQuery(platformAdmin, 'org-1'),
      ),
    ).toEqual(developer());
    await expect(
      new GetDeveloperQueryHandler(developerQueries(null)).execute(
        new GetDeveloperQuery(platformAdmin, 'x'),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
