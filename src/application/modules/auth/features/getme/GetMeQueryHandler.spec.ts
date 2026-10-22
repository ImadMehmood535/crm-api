import { account, actor, authQueries } from '../../../../../../test/support/auth-mocks';
import { UnauthenticatedError } from '@shared/errors/AppError';

import { GetMeQuery } from './GetMeQuery';
import { GetMeQueryHandler } from './GetMeQueryHandler';

describe('GetMeQueryHandler', () => {
  it("should return the caller's AuthUser", async () => {
    const result = await new GetMeQueryHandler(authQueries()).execute(new GetMeQuery(actor()));

    expect(result).toEqual(account().user);
  });

  it('should answer UNAUTHENTICATED when the user no longer exists', async () => {
    await expect(
      new GetMeQueryHandler(authQueries(null)).execute(new GetMeQuery(actor())),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
